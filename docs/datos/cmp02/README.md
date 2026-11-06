# Datos representativos para CMP-02 — issue #36

Todos los nombres, ubicaciones y correos son ficticios. No se han validado con Marcela y no representan disponibilidad de personas reales. Usarlos únicamente en una base local o de pruebas.

## Archivos y carga

- `organizaciones.csv`: corresponde a las columnas de `organizaciones_receptoras` de la migración 0001. Incluye destinos con y sin refrigeración, capacidad y posibilidad de recoger.
- `voluntarios.csv`: archivo de intercambio, **no una copia directa de la tabla**. `usuario_id`, `medio_transporte` y `disponibilidad` pertenecen a `voluntarios`; `nombre` y `email` pertenecen a `usuarios`.
- El script de demostración añade dos comercios ficticios y quince rescates (tres en cada estado), con actores e historial coherentes para preparar también CMP-03 y el demo de CMP-05.

Aplicar todas las migraciones hasta `0004` antes de cargar. El seed crea los usuarios voluntarios, cuentas demo de fundación/comercio/organización, relaciones de catálogo y rescates con UUID deterministas dentro de una transacción. Usa el mecanismo Argon2 de la aplicación para guardar hashes de contraseña. No sobrescribe registros con esos UUID que ya existan. No cargar estos datos en producción.

El script `src/backend/scripts/seed_demo.py` carga los archivos y los rescates en una transacción; usa UUID deterministas y deja intactos los registros que ya existan. Está limitado a PostgreSQL en `localhost`, rechaza los entornos Render/producción y requiere `ALLOW_DEMO_SEED=1` y `SEED_PASSWORD`.

Desde `src/backend`, con las migraciones aplicadas y `DATABASE_URL` apuntando a una base PostgreSQL local aislada:

```powershell
$env:ALLOW_DEMO_SEED = "1"
$env:SEED_PASSWORD = "una-clave-local-de-prueba"
python -m scripts.seed_demo
```

Las contraseñas no se guardan en el repositorio ni se imprimen. Usa una clave de prueba diferente a cualquier credencial personal. Los rescates disponibles, asignados y recogidos tienen hora límite futura; los entregados abarcan dos meses distintos y todos conservan su secuencia de historial. El script **no se ha ejecutado** contra una base en esta preparación. La entrega de fixture y script adelanta #36/#26, pero **no cierra** sus criterios de aceptación.

## Casos preparados para QA

| Criterio | Preparación | Resultado esperado |
|---|---|---|
| CA-02.1 | Rescate disponible, organización A y voluntario A, actor fundación | Asignado con organización, voluntario, fecha y actor; una sola transición |
| CA-02.2 | Dos solicitudes simultáneas al mismo rescate, voluntarios A y B | Un ganador; la otra solicitud falla con conflicto y no sustituye al ganador |
| CA-02.3 | Consultar con el voluntario ganador | Ve lugar/hora límite de recogida, cantidad y dirección del destino |
| RF-024 | Repetir con otro voluntario o un comercio | No obtiene datos ni modifica asignaciones ajenas |
| RF-002 / RF-006 | Consultar catálogos | Se conservan capacidad, refrigeración, horario, recogida, transporte y disponibilidad |
| CA-03.1 / CA-03.2 | Consultar rescates sin entregar | Aparecen disponibles, asignados y recogidos; los disponibles indican pendiente de asignar |
| CA-03.3 | Consultar historial por rescate | Actor, estado previo/nuevo y hora siguen un orden cronológico |
| CA-03.4 | Revisar rescates no completados | Se conserva el motivo y no aparecen como activos |
| CMP-05 / #20 | Consultar periodos distintos | Solo cuentan entregados; #26 puede comprobar agregados al integrarse la consulta |

La organización C y el voluntario C permiten comprobar cómo se presenta la falta de disponibilidad. No se introduce una regla automática de rechazo por capacidad: el alcance debe acordarse con PO/UX antes de implementarla.

## Pendientes para aceptar #36

- Cargar datos con el mecanismo del equipo y comprobar integridad de las referencias.
- Verificar que GET de organizaciones y voluntarios devuelve los registros.
- Ejecutar CA-02.1 de punta a punta y adjuntar evidencia de QA.
- Confirmar con Marcela datos reales si se necesita operación real; mantenerlos fuera de este fixture público.
- Ejecutar el seed en PostgreSQL local aislado con QA, verificar segunda ejecución sin duplicados y probar las cuentas según permisos; adjuntar evidencia de PostgreSQL.
