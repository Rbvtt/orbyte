# Revisión del PO — 29 de octubre de 2026

## Alcance y estado comprobado

El alcance exacto de la próxima entrega académica no está confirmado. El tablero coloca CMP-01 y CMP-02 en Sprint 1 (17–23 de octubre); Sprint 2 abarca 24–30 de octubre. Esto es planificación interna, no prueba del alcance exigido por el docente. Se mantiene la planificación existente hasta confirmar la guía.

`main` integra #64 (c703a4c), #65 (447e072) y #66 (014438d). El esquema no equivale a una aplicación terminada: autenticación, registro, formulario y asignación aún requieren integración.

## Auditoría de terminado — #25

| Issue | PR integrado | Evidencia disponible | Pendiente |
|---|---|---|---|
| #29 | #64 | Pruebas locales de `/health`, CORS permitido/rechazado, configuración y `pip check`; `.env` excluido y ejemplo permitido | Registrar la revisión del equipo; no confundir health con disponibilidad de BD |
| #5 | #65 | Revisión del esquema contra el issue y generación SQL upgrade/downgrade; el autor declara pruebas en PostgreSQL 18.4 en el PR | QA debe aportar ejecución reproducible contra PostgreSQL; Codex no pudo repetirla por motor Docker no disponible |

Los issues se cerraron automáticamente por los merges y aparecen en Finalizado. La validación independiente de BD sigue pendiente; el cierre automático no es evidencia de cumplimiento completo de la DoD. No se marca esa prueba como realizada ni se da por aceptado CMP-01.

## Seguimiento de CMP-01 — #30

Solo #5 estaba cerrado entre sus siete sub-issues. Permanecen abiertos #6 (API, Alejandro), #7 (UX, Jhon), #8 (formulario, Malcom), #9 (QA, Mauriel), #41 (UX asistido, Jhon) y #42 (formulario asistido, Jhon). La aceptación debe cubrir CA-01.1, CA-01.2 y CA-01.3, incluyendo celular y computador cuando aplique.

## Tablero — #59

Se observaron las cinco historias #30–#34, sus sub-issues, vistas de sprints, prioridades y campos de criterio/requerimiento. Los 59 elementos visibles por grupos de sprint se distribuyen en 23, 22, 10 y 4 elementos. No se certifica todavía que todos los issues del repositorio tengan todos los campos y grupo completos.

Siete tareas figuraban En revisión: #7, #14, #37, #10, #40, #6 y #11, mientras no había PR abiertos tras las fusiones. Esto exige reconciliar cada tarea con su rama y PR; no demuestra que el código se haya perdido ni que esté terminado. Los PR #68 y #69 estaban cerrados sin aportar esos cambios a `main`.

Acciones pendientes del equipo: asociar o abrir los PR de esas ramas, adjuntar evidencia, revisar el código e integrar en orden de dependencias. No se reabren ni fusionan automáticamente PR cerrados sin analizar por qué se cerraron.

## Avance de CMP-02

Se prepararon CSV ficticios de organizaciones y voluntarios y casos de aceptación en `docs/datos/cmp02/`. La carga, los catálogos y la asignación de punta a punta siguen pendientes. El plan técnico documenta la asignación atómica (#11), su prueba concurrente (#13), la relación organización/persona receptora y los permisos previstos (#40).

## Decisiones que siguen abiertas

- Confirmar alcance de la entrega con la guía docente.
- #55: el ADR incorporado sigue en estado Propuesta. No se contrató ningún plan ni se acordó pagador. DevOps debe registrar fecha real de creación y vencimiento al desplegar.
- #36: validar representatividad con PO y datos reales con Marcela si corresponden.
- #26 y #61: dataset completo y manual de operación dependen de funciones todavía no integradas; no se documentan como existentes ni se fabrican capturas de uso.
