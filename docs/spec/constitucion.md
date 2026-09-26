# Constitución del proyecto

## Propósito

El equipo Orbyte construirá una aplicación web responsiva para que la Fundación Mesa Común coordine rescates de alimentos, desde el aviso hasta el cierre y el reporte básico.

## Roles

| Integrante | Rol |
| --- | --- |
| David Astudillo | Product Owner |
| Alejandro Caicedo Cajiao | Developer |
| Malcom Alexis Osorio Fajardo | Developer |
| Mauriel Rodriguez Ospina | QA Engineer |
| Samuel David Garcia Valencia | DevOps Engineer |
| Jhon Dairon Zuluaga Hoyos | UX Designer |

## Convenciones de trabajo

- La rama `main` conserva versiones integradas y funcionales.
- Cada trabajo se desarrolla en una rama con nombre descriptivo, por ejemplo `feature/registro-rescate` o `fix/asignacion-unica`.
- Los commits usan mensajes breves en imperativo, por ejemplo `Agrega formulario de aviso`.
- Todo cambio integrado se revisa mediante un pull request por al menos un integrante diferente de quien lo implementó.
- Las tareas del tablero se relacionan con el Issue, el comportamiento o el criterio de aceptación correspondiente.
- No se incorporan secretos, contraseñas, tokens ni datos personales innecesarios al repositorio.

## Uso de IA

El equipo puede usar asistentes de IA para proponer borradores, aclarar conceptos, revisar textos o apoyar tareas de desarrollo. Ninguna salida se incorpora sin revisión humana, pruebas cuando corresponda y verificación con los requisitos del proyecto. No se comparten credenciales ni información personal sensible con estas herramientas.

## Definición de Listo

Una historia puede pasar a **Pendiente** cuando:

- [ ] Tiene título y descripción como historia de usuario.
- [ ] Indica el comportamiento o requerimiento del que proviene.
- [ ] Tiene criterios de aceptación verificables en formato Dado, cuando, entonces.
- [ ] Tiene prioridad definida.
- [ ] Tiene responsable o queda disponible para asignación.
- [ ] Se identificaron dependencias, riesgos o preguntas pendientes.
- [ ] El equipo estimó el esfuerzo de manera acordada.
- [ ] La interfaz o el flujo fue revisado por UX cuando aplica.

## Definición de Terminado

Una historia puede pasar a **Hecho** cuando:

- [ ] Cumple todos sus criterios de aceptación.
- [ ] El código fue revisado mediante pull request.
- [ ] Las pruebas definidas pasan y se registró la evidencia.
- [ ] No presenta errores críticos conocidos.
- [ ] La documentación afectada se actualizó.
- [ ] Fue integrada en `main`.
- [ ] Se validó en una pantalla de celular y una de computador cuando aplica.
- [ ] Se comprobó que no expone datos ni permisos innecesarios.
