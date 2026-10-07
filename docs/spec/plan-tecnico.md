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

## Integraciones
Debido al techo presupuestal y para minimizar dependencias que puedan generar fallos, el MVP se mantendrá con dependencias externas mínimas:
- **Servicios de Identidad/Autenticación:** El sistema gestionará credenciales seguras de manera interna (usando tokens JWT desde FastAPI).
- *Posibles integraciones futuras (fuera del MVP):* Una vez validado el piloto y asegurada la financiación, se podría evaluar la integración de un servicio de notificaciones transaccionales (SMS o correo) para avisar rápidamente al voluntario asignado.

## Entorno y despliegue
Para asegurar que Marcela y Diana no tengan que administrar infraestructura ni lidiar con servidores, el entorno utilizará plataformas gestionadas (PaaS) que ofrecen capas gratuitas (mitigando el riesgo de exceder los $150.000 mensuales):
- **Despliegue del Frontend:** **Vercel**. Alojará la aplicación en React. Garantiza que la página siempre esté disponible mediante un enlace seguro, cargando con alta velocidad y actualizándose automáticamente con cada cambio en la rama `main` del repositorio.
- **Despliegue del Backend y Base de datos:** **Render**. Alojará el servidor de FastAPI y la base de datos PostgreSQL. Esta plataforma administra la red y la seguridad automáticamente, cumpliendo la necesidad de una operación sin equipo técnico dedicado.
