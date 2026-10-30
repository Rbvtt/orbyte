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

La migración inicial se complementa con una segunda migración que relaciona
usuarios de rol comercio con `comercios`, registra `rescate_historial` y
persiste claves `Idempotency-Key` para evitar avisos duplicados.

### Decisión técnica R4: asignación atómica

La asignación de un rescate usa compare-and-set en una sola sentencia
`UPDATE ... WHERE estado = 'disponible' AND voluntario_id IS NULL RETURNING
id`. En el nivel de aislamiento `READ COMMITTED` de PostgreSQL, las
asignaciones concurrentes compiten atómicamente por la misma fila: exactamente
una puede cumplir la condición y las demás afectan cero filas. Así se evita un
`SELECT ... FOR UPDATE` explícito, se reduce la contención y disminuye el
riesgo de deadlocks. El `CHECK`
`estado NOT IN ('asignado', 'recogido', 'entregado') OR voluntario_id IS NOT
NULL` funciona como red de seguridad para impedir estados avanzados sin
voluntario, incluso si otra operación omite el servicio.

Se descartan las siguientes alternativas:

- **Lock pesimista con `SELECT FOR UPDATE`:** añade una sentencia y mantiene
  bloqueos explícitos durante la transacción, con más contención y mayor
  superficie para deadlocks.
- **Bloqueo optimista con columna de versión:** requiere una columna adicional,
  incrementar y validar versiones, y resolver conflictos con lógica extra sin
  aportar una garantía superior para este caso.
- **Advisory locks:** desplazan la coordinación fuera de la fila y exigen que
  todas las rutas conozcan y respeten la misma clave de bloqueo; no sustituyen
  la integridad declarativa del `CHECK`.

## Integraciones
Debido al techo presupuestal y para minimizar dependencias que puedan generar fallos, el MVP se mantendrá con dependencias externas mínimas:
- **Servicios de Identidad/Autenticación:** El sistema gestionará credenciales seguras de manera interna (usando tokens JWT desde FastAPI).
- *Posibles integraciones futuras (fuera del MVP):* Una vez validado el piloto y asegurada la financiación, se podría evaluar la integración de un servicio de notificaciones transaccionales (SMS o correo) para avisar rápidamente al voluntario asignado.

## Entorno y despliegue
Para asegurar que Marcela y Diana no tengan que administrar infraestructura ni lidiar con servidores, el entorno utilizará plataformas gestionadas (PaaS) que ofrecen capas gratuitas (mitigando el riesgo de exceder los $150.000 mensuales):
- **Despliegue del Frontend:** **Vercel**. Alojará la aplicación en React. Garantiza que la página siempre esté disponible mediante un enlace seguro, cargando con alta velocidad y actualizándose automáticamente con cada cambio en la rama `main` del repositorio.
- **Despliegue del Backend y Base de datos:** **Render**. Alojará el servidor de FastAPI y la base de datos PostgreSQL. Esta plataforma administra la red y la seguridad automáticamente, cumpliendo la necesidad de una operación sin equipo técnico dedicado.
- **Plan de la base de datos:** La base PostgreSQL gratuita de Render vence 30 días después de creada. La propuesta es usarla hasta la Demo y luego pasarla a Basic-256mb, que cuesta unos $19.900 COP al mes. Neon Free queda como alternativa sin costo. Ver [ADR 0001](../decisiones/0001-plan-base-de-datos-render.md).
