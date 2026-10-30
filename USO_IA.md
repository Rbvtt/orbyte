# Uso de inteligencia artificial

Registro basado en la evidencia disponible al 29 de octubre de 2026. Cada integrante debe añadir las herramientas y usos que falten; este documento no certifica actividades no verificadas.

| Herramienta | Uso identificado | Evidencia |
|---|---|---|
| OpenAI Codex | Organización inicial del repositorio y documentación; revisión de PR, comprobaciones locales de configuración y CORS; apoyo al PO para plan técnico, auditoría y datos ficticios de prueba. | README, PR #64–#66 y cambios que incorporan este documento. |
| Claude Code | Asistencia en variables de entorno, migración inicial PostgreSQL y propuesta de alojamiento. | Declaraciones de los PR #64, #65 y #66 y coautoría de sus commits. |
| GitHub Copilot | Participación registrada en los PR de autenticación y registro de avisos. Estos PR estaban cerrados y su código no estaba integrado en `main` en la revisión. | PR #68 y #69; actividad del issue #5. |

El equipo conserva la responsabilidad de revisar las propuestas, ejecutar las pruebas y contrastarlas con los requisitos. Una herramienta no sustituye la revisión humana ni la aceptación del Product Owner. No se introducen credenciales ni datos personales reales en los datos de prueba de este cambio.

Las comprobaciones ejecutadas con Codex validaron `/health`, CORS, configuración, dependencias y generación SQL de Alembic. No equivalen a ejecutar migraciones contra PostgreSQL ni a validar CMP-01 o CMP-02 de punta a punta.
