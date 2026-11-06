# Plan técnico

## Alternativa seleccionada

La alternativa seleccionada en el Módulo 2 es una aplicación web responsiva con panel administrativo. Se priorizan formularios breves, navegación desde un enlace y bajo consumo de datos para apoyar a la Fundación Mesa Común y a los comercios con conectividad limitada.

## Arquitectura

- **Frontend:** React con Next.js, en `src/frontend/`.
- **Backend:** FastAPI (Python), en `src/backend/`.
- **Comunicación:** API REST con JSON.
- **Persistencia:** PostgreSQL, con cambios de esquema gestionados por Alembic.
- **Autenticación:** tokens JWT verificados por el backend y controles por rol y pertenencia al recurso.

## Modelo de datos

El esquema integrado incluye `usuarios`, `comercios`, `organizaciones_receptoras`, `voluntarios`, `rescates`, `historial_estados` y `idempotency_keys`.

| Entidad o campos | Uso | Estado comprobado en `main` al 2026-11-06 |
|---|---|---|
| Aviso: comercio, alimento, cantidad aproximada, lugar, hora límite, actor y fecha | CA-01.1 y CA-01.3 | API `POST /api/v1/rescates` y formulario integrados (#6, #8). El flujo asistido #42 figura En revisión y no está integrado en `main`; CMP-01 aún requiere QA. |
| Organizaciones y voluntarios | RF-002, RF-006, CA-02.1/CA-02.3 | Tablas y endpoints de catálogo integrados (#5, #39). El fixture ficticio y el seed para la demo están preparados en `docs/datos/cmp02/`; falta cargar y verificar los datos en una base QA y completar CA-02.1. |
| `organizacion_id`, `voluntario_id`, `asignado_en`, `asignado_por` | CA-02.1 | Columnas, API, controles de rol y operación atómica integrados (#10, #11, #40). La prueba de concurrencia de PostgreSQL sigue pendiente (#13). |
| `recogido_en`, `entregado_en`, `recibido_por`, cantidad, unidad, medida/estimación y personas beneficiadas | CA-04.1–CA-04.3 | Columnas integradas en el esquema (#5); endpoints y pantallas de CMP-04 siguen pendientes. |
| `motivo_no_completado` | CA-03.4 | Columna integrada; falta el endpoint y su interfaz (#44). |
| `historial_estados` | CA-03.3, RF-014, RF-015, RNF-011 | Migración append-only y escritura atómica en creación/asignación integradas (#35). Falta consulta API/UI del historial (#43, #15). |

La organización receptora (`rescates.organizacion_id`) es distinta de la persona autenticada que recibe (`rescates.recibido_por`, FK a `usuarios.id`). `usuarios.organizacion_id` asocia a la persona con su organización. `usuarios.comercio_id` asocia el usuario comercio a su comercio; el servidor obtiene la identidad del token y no acepta una pertenencia elegida por el cliente.

Los datos almacenados para la recepción no implementan por sí solos las reglas de transición, pertenencia al destino, validación de cantidades o permisos de CA-04. Esas reglas permanecen pendientes junto con los endpoints de la historia CMP-04.

## Asignación atómica e historial

La API de asignación usa una única actualización condicional equivalente a:

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

En PostgreSQL, solo una solicitud concurrente puede cambiar la fila disponible; la API devuelve conflicto cuando otra solicitud ya ganó. La migración `0003` añade un CHECK que exige voluntario en estados `asignado`, `recogido` y `entregado`. La API agrega el movimiento a `historial_estados` dentro de la misma transacción. La prueba de carrera contra PostgreSQL y su evidencia son el pendiente de #13.

La migración `0004` define `historial_estados` con `id`, `rescate_id`, `estado_anterior`, `estado_nuevo`, `actor_id`, `ocurrido_en` y `detalle JSONB`, y bloquea modificaciones y borrados. La función `cambiar_estado()` ya proporciona actualización condicional e inserción atómica del historial. Aún falta exponer el historial para CMP-03 y usar esta transición en los endpoints de recogida, entrega y cierre no completado.

## Matriz de permisos

El backend valida el rol y la pertenencia al rescate. La autenticación JWT y las consultas de lista/detalle están integradas (#37, #40); las acciones futuras deben aplicar los permisos indicados y acompañarse de pruebas de acceso cruzado.

| Acción | Fundación | Comercio | Voluntario | Organización |
|---|---|---|---|---|
| Registrar aviso | En nombre de un comercio | Solo para su comercio | No | No |
| Asignar organización y voluntario | Sí | No | No | No |
| Consultar detalle | Cualquier rescate | Avisos propios | Si está asignado | Si es el destino |
| Consultar activos | Sí | No | No | No |
| Registrar recogida | No | No | Voluntario asignado, desde `asignado` (pendiente #16) | No |
| Confirmar recepción y beneficiados | No | No | No | Organización destino, desde `recogido` (pendiente #17/#48) |
| Marcar no completado | Fundación, con motivo y estado permitido (pendiente #44) | No | No | No |
| Consultar impacto | Sí (pendiente #51) | No | No | No |

Para detalles no autorizados se responde 404, evitando revelar la existencia del recurso. El conteo de beneficiados debe ser visible solo para la Fundación y la organización receptora, conforme a RNF-005.

## Próximas entregas de comportamiento

- **CMP-02:** están integradas la consulta de catálogos, la vista de asignación, el endpoint y la protección atómica. Falta cargar los datos de prueba, ejecutar la asignación de punta a punta y que QA demuestre concurrencia en PostgreSQL (#36, #13).
- **CMP-03:** están integradas la lista de rescates activos, el indicador pendiente de asignar, el detalle filtrado por rol y la escritura del historial (#37, #38, #12, #35). Faltan GET del historial (#43), cierre no completado (#44), la línea de tiempo (#15) y la suite de aceptación (#49).
- **CMP-04:** la recogida, confirmación de entrega y beneficiados aún requieren API, interfaz y QA (#16–#18, #45–#50).
- **CMP-05:** agregación de impacto y su detalle aún requieren diseño, API, interfaz y QA (#19–#24, #51).

El seed de demostración usa exclusivamente registros ficticios y requiere una base aislada. No sustituye la recopilación con Marcela si se usarán datos operativos reales. El alcance de la entrega académica debe cotejarse con la guía del curso antes de descartar historias posteriores.

## Integraciones y despliegue propuestos

El MVP gestiona credenciales y JWT internamente. Notificaciones por SMS o correo se consideran una posible integración futura.

El plan propone Vercel para el frontend y Render para FastAPI y PostgreSQL. El costo, la fecha de vencimiento del plan gratuito y quién pagaría deben confirmarse al desplegar; el ADR 0001 sigue siendo una propuesta.
