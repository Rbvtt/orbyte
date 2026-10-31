# Plan técnico

## Alternativa seleccionada
La alternativa seleccionada en el Módulo 2 es la **Aplicación web responsiva con panel administrativo**. Esta opción fue elegida porque mitiga las restricciones críticas de la Fundación Mesa Común:
- **Ausencia de soporte técnico y presupuesto ajustado:** Su desarrollo unificado y el uso de plataformas sin mantenimiento manual permiten que el sistema sea operado por Marcela y Diana manteniéndose dentro del límite mensual de $150.000 COP.
- **Conectividad limitada y dispositivos básicos:** Al ser un sistema que se abre desde un enlace, evita la instalación de aplicaciones en los teléfonos básicos (usados por 4 de los 14 comercios) y reduce la fricción en la coordinación de rescates urgentes.

## Arquitectura
La aplicación utilizará una arquitectura cliente-servidor separada (Frontend y Backend desacoplados) para garantizar rapidez y bajo consumo de datos:
- **Frontend (Cliente):** Se construirá con **React** (Single Page Application). Esto permite crear una interfaz ligera y formularios breves que cargan rápido, mitigando el riesgo de la mala conectividad de los voluntarios con datos prepago limitados.
- **Backend (Servidor):** Se implementará con **FastAPI** (Python). Es un framework de alto rendimiento y bajo consumo de recursos, ideal para procesar rápidamente los cambios de estado (aviso, asignación, recogida) manteniendo bajos los costos de operación.
- **Comunicación:** El Frontend consumirá los datos del Backend a través de una API REST, enviando y recibiendo únicamente JSON (datos de texto ligeros) para reducir al máximo el uso de internet móvil.

## Modelo de datos
Para garantizar la trazabilidad exigida por el caso y evitar el doble conteo de entregas o rescates duplicados, la información se estructurará en una base de datos relacional (**PostgreSQL**). Las entidades principales son:

- **Usuario:** Almacena los datos de inicio de sesión y el rol (Fundación, Voluntario, Organización, Comercio) para controlar permisos y mitigar el riesgo de acceso indebido.
- **Rescate (Entidad central):**
  - *Atributos:* ID único, alimento, cantidad aproximada, lugar de recogida, hora límite, cantidad final recibida (marcada como estimada o medida).
  - *Estados (Trazabilidad):* `disponible` -> `asignado` -> `recogido` -> `entregado` (o `no completado`).
  - *Asociaciones:* Fecha y hora de creación, quién registró (comercio o fundación asistida), voluntario asignado, y organización receptora.
- **Reporte / Impacto:** Una vista o tabla consolidada que suma los kilogramos recibidos y personas beneficiadas por periodo, filtrando estrictamente los rescates en estado `entregado`.

## Modelo detallado, transacciones y permisos

### Detalle del modelo y trazabilidad

El esquema integrado por el PR #65 contiene `usuarios`, `comercios`, `organizaciones_receptoras`, `voluntarios` y `rescates`. La siguiente separación distingue lo implementado del diseño aún pendiente:

| Entidad o campos | Uso y criterio | Estado al 29-10-2026 |
|---|---|---|
| `rescates`: comercio, alimento, cantidad aproximada, lugar y hora límite; `registrado_por`, `creado_en` | CA-01.1 y CA-01.3; identidad del comercio y del actor que registra | Columnas, API y formulario integrados |
| `organizaciones_receptoras`: capacidad, refrigeración, horario, puede recoger | RF-002 y CA-02.1; elegir destino adecuado | Tabla integrada; datos representativos en `docs/datos/cmp02/` |
| `voluntarios`: usuario, transporte y disponibilidad | RF-006 y CA-02.1/CA-02.3 | Tabla integrada; datos representativos preparados |
| `organizacion_id`, `voluntario_id`, `asignado_en`, `asignado_por` | CA-02.1; destino, traslado y responsable de asignación | Columnas integradas; operación atómica pendiente (#11) |
| `recogido_en`, `entregado_en`, `recibido_por`, `cantidad_recibida`, `unidad_recibida`, `es_medida`, `personas_beneficiadas` | CA-04.1–CA-04.3; recepción e impacto trazables | Columnas integradas; validación de transición pendiente |
| `motivo_no_completado` | CA-03.4; explicación del cierre sin entrega | Columna y CHECK de no nulo integrados |
| `historial_estados` | CA-03.3, RF-014, RF-015, RNF-011 | Diseño pendiente de implementación en #35 |

La organización es la entidad receptora (`rescates.organizacion_id`); quien recibe es una persona autenticada (`rescates.recibido_por` → `usuarios.id`). No son intercambiables. La API debe comprobar que el usuario pertenece a la organización destino. `usuarios.organizacion_id` expresa esa relación. La relación usuario–comercio se implementa mediante `usuarios.comercio_id`; la API expone la asociación en `/auth/me` y solo permite al rol comercio registrar para su propio comercio.

El esquema inicial no impone todas las reglas de negocio. Por ejemplo, los campos de recepción existentes no sustituyen la validación de estado previo, pertenencia al destino, unidad, condición medida/estimada y fecha de entrega exigida por CA-04.2 y CA-04.4.

### Asignación atómica y registro de movimientos

Para #11 se elige una única sentencia condicional, parametrizada, en PostgreSQL READ COMMITTED:

```sql
UPDATE rescates
SET voluntario_id = :voluntario_id,
    organizacion_id = :organizacion_id,
    estado = 'asignado',
    asignado_en = now(),
    asignado_por = :actor_id
WHERE id = :rescate_id
  AND estado = 'disponible'
  AND voluntario_id IS NULL
RETURNING id;
```

PostgreSQL serializa las actualizaciones concurrentes de la misma fila y vuelve a comprobar la condición: solo una solicitud puede cambiar un rescate disponible. La API debe distinguir inexistencia (404) de conflicto de asignación (409), validar el rol y las referencias, y no anunciar éxito cuando no se devuelve ninguna fila. No se hace una lectura seguida de una escritura incondicional. #13 debe demostrar exactamente un ganador y que se conserva su voluntario. #11 también contempla un CHECK que exija voluntario en estados asignado, recogido y entregado; no está en la migración inicial.

El historial previsto en #35 contiene `id`, `rescate_id`, `estado_anterior`, `estado_nuevo`, `actor_id`, `ocurrido_en` y `detalle JSONB`. La actualización condicional y el INSERT del historial deben compartir transacción; un fallo del historial revierte el cambio. El rol de aplicación no tendrá UPDATE ni DELETE sobre el historial y debe ser distinto del propietario usado para migraciones. Esta protección y la función `cambiar_estado()` siguen pendientes: no se presentan como capacidades actuales.

### Matriz de permisos prevista (RF-024 / #40)

Los permisos se verifican en el servidor por rol **y por pertenencia al recurso**. Esta matriz expresa el comportamiento esperado; su implementación y pruebas corresponden a #40 y a cada endpoint.

| Acción | Fundación | Comercio | Voluntario | Organización |
|---|---|---|---|---|
| Registrar aviso | En nombre de un comercio (CA-01.3) | Solo el propio comercio | No | No |
| Asignar destino y voluntario | Sí | No | No | No |
| Consultar rescates | Seguimiento de rescates | Solo propios | Solo asignados a sí mismo | Solo los de su organización |
| Registrar recogida | No | No | Solo el asignado, desde `asignado` | No |
| Confirmar recepción y registrar beneficiados | No | No | No | Solo destino, desde `recogido` |
| Cerrar como no completado | Sí, con motivo y estado permitido | No | No | No |
| Consultar impacto global | Sí | No | No | No |

Los beneficiados solo son visibles para fundación y organización destino. El usuario y rol proceden del token verificado y del usuario activo, no de campos de identidad enviados por el cliente. Sin autenticación: 401; rol no autorizado: 403. Los endpoints deben evitar exponer recursos ajenos y contar con pruebas de acceso cruzado. La matriz no amplía el alcance de la entrega académica, que debe confirmarse con su guía.

## Integraciones

Debido al techo presupuestal y para minimizar dependencias que puedan generar fallos, el MVP se mantendrá con dependencias externas mínimas:
- **Servicios de Identidad/Autenticación:** El sistema gestionará credenciales seguras de manera interna (usando tokens JWT desde FastAPI).
- *Posibles integraciones futuras (fuera del MVP):* Una vez validado el piloto y asegurada la financiación, se podría evaluar la integración de un servicio de notificaciones transaccionales (SMS o correo) para avisar rápidamente al voluntario asignado.

## Entorno y despliegue
Para asegurar que Marcela y Diana no tengan que administrar infraestructura ni lidiar con servidores, el entorno utilizará plataformas gestionadas (PaaS) que ofrecen capas gratuitas (mitigando el riesgo de exceder los $150.000 mensuales):
- **Despliegue del Frontend:** **Vercel**. Alojará la aplicación en React. Garantiza que la página siempre esté disponible mediante un enlace seguro, cargando con alta velocidad y actualizándose automáticamente con cada cambio en la rama `main` del repositorio.
- **Despliegue del Backend y Base de datos:** **Render**. Alojará el servidor de FastAPI y la base de datos PostgreSQL. Esta plataforma administra la red y la seguridad automáticamente, cumpliendo la necesidad de una operación sin equipo técnico dedicado.
- **Plan de la base de datos:** La base PostgreSQL gratuita de Render vence 30 días después de creada. La propuesta es usarla hasta la Demo y luego pasarla a Basic-256mb, que cuesta unos $19.900 COP al mes. Neon Free queda como alternativa sin costo. Ver [ADR 0001](../decisiones/0001-plan-base-de-datos-render.md).
