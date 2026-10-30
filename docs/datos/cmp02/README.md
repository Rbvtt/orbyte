# Datos representativos para CMP-02 — issue #36

Todos los nombres, ubicaciones y correos son ficticios. No se han validado con Marcela y no representan disponibilidad de personas reales. Usarlos únicamente en una base local o de pruebas.

## Archivos y carga

- `organizaciones.csv`: corresponde a las columnas de `organizaciones_receptoras` de la migración 0001. Incluye destinos con y sin refrigeración, capacidad y posibilidad de recoger.
- `voluntarios.csv`: archivo de intercambio, **no una copia directa de la tabla**. `usuario_id`, `medio_transporte` y `disponibilidad` pertenecen a `voluntarios`; `nombre` y `email` pertenecen a `usuarios`.

Aplicar primero la migración 0001. El cargador del equipo debe crear los usuarios voluntarios con esos UUID y rol `voluntario` antes de insertar `voluntarios`. Las contraseñas se crean localmente mediante el mecanismo de autenticación del equipo y se guardan como hashes válidos; no hay contraseñas compartidas ni hashes inventados en estos archivos. Los UUID fijos permiten al cargador evitar duplicados por clave primaria. No sobrescribir registros ajenos ni cargar estos datos en producción.

El script de carga y los endpoints todavía no están integrados en `main` al preparar estos datos. La entrega del CSV adelanta #36, pero **no cierra** sus criterios de aceptación.

## Casos preparados para QA

| Criterio | Preparación | Resultado esperado |
|---|---|---|
| CA-02.1 | Rescate disponible, organización A y voluntario A, actor fundación | Asignado con organización, voluntario, fecha y actor; una sola transición |
| CA-02.2 | Dos solicitudes simultáneas al mismo rescate, voluntarios A y B | Un ganador; la otra solicitud falla con conflicto y no sustituye al ganador |
| CA-02.3 | Consultar con el voluntario ganador | Ve lugar/hora límite de recogida, cantidad y dirección del destino |
| RF-024 | Repetir con otro voluntario o un comercio | No obtiene datos ni modifica asignaciones ajenas |
| RF-002 / RF-006 | Consultar catálogos | Se conservan capacidad, refrigeración, horario, recogida, transporte y disponibilidad |

La organización C y el voluntario C permiten comprobar cómo se presenta la falta de disponibilidad. No se introduce una regla automática de rechazo por capacidad: el alcance debe acordarse con PO/UX antes de implementarla.

## Pendientes para aceptar #36

- Cargar datos con el mecanismo del equipo y comprobar integridad de las referencias.
- Verificar que GET de organizaciones y voluntarios devuelve los registros.
- Ejecutar CA-02.1 de punta a punta y adjuntar evidencia de QA.
- Confirmar con Marcela datos reales si se necesita operación real; mantenerlos fuera de este fixture público.
