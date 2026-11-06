# Revisión del PO — 6 de noviembre de 2026

Esta revisión contrasta el tablero con el `main` observado en `60bca2d`. Actualiza y reemplaza como referencia actual la revisión del 29 de octubre.

## Qué puede avanzar PO ahora

| Issue | Avance preparado en esta rama | Qué falta para cerrarlo |
|---|---|---|
| #58 — plan técnico | Se actualizó `docs/spec/plan-tecnico.md` con lo que está integrado y lo que falta en CMP-02/03/04/05. | Revisión de otra persona e integración por PR. |
| #59 — estructura del tablero | Se contrastaron historias, tareas, sprints y estados visibles; se anotaron inconsistencias con `main`. | Auditar todos los issues contra los campos Sprint, Estimación, Criterio y Requerimiento. En la vista observada se ven prioridad y requerimiento en las tarjetas; no hay evidencia suficiente para certificar que Estimación y Criterio estén completos. |
| #36 — datos iniciales | El fixture ficticio y el seed local cubren tres organizaciones, tres voluntarios, cuentas demo y quince rescates en los cinco estados. Carga verificada en PostgreSQL 18 aislado; login, consulta de catálogos, CA-02.1, detalle del voluntario e historial respondieron correctamente. | PO debe confirmar con Marcela los datos reales si se usarán operativamente. QA debe revisar/adjuntar esta evidencia al issue antes de cerrarlo. |
| #26 — dataset del demo | `src/backend/scripts/seed_demo.py` cargó rescates e historial, con entregas en dos meses, y se ejecutó dos veces: 15 rescates nuevos en la primera y 0 en la segunda. Las relaciones e historiales se verificaron en PostgreSQL 18 aislado. Python reutiliza el hash Argon2 de la aplicación para las cuentas demo. | El issue menciona `seed_demo.sql`; PO/revisores deben confirmar si aceptan el script Python por seguridad de credenciales. Adjuntar la evidencia local y confirmar el enfoque SQL/Python para aceptar el issue. |

## CMP-02 — disponible para que QA pruebe

Ya están en `main` la API de registro y autenticación, el catálogo, la pantalla y endpoint de asignación, el detalle por rol, la asignación compare-and-set y la escritura de historial (`#6`, `#10`, `#11`, `#35`, `#39`, `#40`). El tablero aún deja #39 En curso aunque la interfaz está integrada. La tarea de QA #13 pide diez asignaciones simultáneas en PostgreSQL, repetir la carrera veinte veces y demostrar una respuesta exitosa, nueve conflictos y una sola transición de historial. No se debe certificar CA-02.2 hasta contar con esa evidencia.

Pendientes de coordinación para CMP-02:

- **PO:** acordar con Marcela si hacen falta datos reales y, si es así, recopilar capacidad, refrigeración, horario y posibilidad de recogida. Los CSV actuales son totalmente ficticios.
- **QA/equipo:** revisar y adjuntar la evidencia ya obtenida en PostgreSQL local aislado para el seed y CA-02.1 de punta a punta.
- **QA:** completar #13 contra PostgreSQL y adjuntar el resultado de concurrencia.
- **PO:** después de verificar evidencia, actualizar los campos/estado del tablero. No adelantar CMP-02 a Finalizado solo porque las historias técnicas estén fusionadas.

## CMP-03 — lista de trabajo y bloqueo de aceptación

En `main` ya están la consulta de activos, el filtro por rol del detalle, la vista de rescates activos y el servicio que escribe cambios de estado de forma atómica (`#12`, `#35`, `#37`, `#38`). La lista cubre disponibles, asignados y recogidos, y calcula `pendiente_asignar` para los disponibles.

Siguen sin estar en `main` las piezas que la suite #49 necesita para cubrir todos los criterios:

| Tarea | Resultado requerido | Quién debe actuar según tablero/issue |
|---|---|---|
| #43 | `GET /rescates/{id}/historial` con transiciones, actor y orden cronológico | Implementación pendiente; issue en backlog. |
| #44 | Cerrar disponible/asignado como no completado con motivo y permisos | Implementación API + interfaz pendiente; issue en backlog. |
| #15 | Mostrar línea de tiempo en el detalle usando el historial | Frontend pendiente; asignado a `cajiao05`. |
| #49 | Automatizar CA-03.1–CA-03.4 y adjuntar evidencia manual de lista/detalle | QA pendiente; asignado a `mauriRodriguez20`. Depende de #43 y #44. |

La suite de QA puede preparar casos y fixtures ahora, pero no completar la aceptación de historial y no completado hasta que #43/#44 estén integrados. #43/#44 son el siguiente bloqueo de implementación; coordinar asignación y fecha con el equipo antes de prometer CMP-03 completo.

## Reconciliación del tablero

En la vista Scrum observada, `#39` sigue En curso aunque su código ya está en `main` por los merges recientes. La columna Finalizado incluye #12, #35, #37 y #38, consistentes con la integración observada. La historia CMP-02 continúa En curso pese a que sus tareas funcionales base están integradas; faltan QA y evidencia. Conviene actualizar los estados de los issues de trabajo al revisar los PR y reservar Finalizado para la DoD completa.

La vista mostraba 34 elementos en Backlog, 8 Por hacer, 3 En curso, 1 En revisión y 13 Finalizados. Las cinco historias CMP-01–CMP-05 y las vistas de sprint existen. Esta observación no certifica por sí sola que todos los issues tengan Estimación, Criterio, Requerimiento y Sprint completos; #59 sigue requiriendo esa auditoría.

## Decisiones y límites

- El alcance de la entrega académica aún debe cotejarse con la guía del curso. CMP-02/03 son la prioridad de este avance; CMP-04/05 no se declaran terminados.
- No se contactó a Marcela ni a los integrantes del equipo desde sus cuentas.
- La suite completa de backend ejecutó contra PostgreSQL 18 local con `72 passed` (incluye integración, concurrencia y reversión de migración). El seed se ejecutó dos veces en una base aislada: 15 inserciones iniciales y 0 nuevas en la segunda; conteos verificados: 3 organizaciones, 3 voluntarios, 15 rescates, 36 transiciones de historial y 2 meses de entregas. El smoke test de API verificó login de fundación, catálogos, CA-02.1, detalle del voluntario asignado e historial (37 transiciones tras la asignación adicional). La suite emitió cuatro warnings de dependencias/clave de prueba, sin fallos.
- La prueba se realizó en un contenedor local `postgres:18-alpine`, con puerto enlazado solo a `127.0.0.1:55432`; las bases de test son desechables y no contienen datos reales. `py_compile` del seed y `git diff --check` pasan.
- El plan de base de datos del ADR 0001 sigue pendiente de decisión/ejecución por DevOps.
