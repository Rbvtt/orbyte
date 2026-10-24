# ADR 0001 · Plan de la base de datos PostgreSQL en Render

- **Estado:** Propuesta, pendiente de aprobación del Product Owner
- **Fecha:** 2026-10-23
- **Issue:** #55
- **Requerimientos:** RNF-008 (costo mensual ≤ $150.000 COP), RNF-010

## Contexto

El plan técnico define Render para alojar el backend y la base PostgreSQL. La base gratuita de Render tiene estas condiciones:

- Vence **30 días después de creada**. Después queda inaccesible hasta que se pase a un plan pago.
- Hay **14 días de gracia**. Si en ese plazo no se pasa a un plan pago, Render la borra junto con todos sus datos.
- No admite respaldos, tiene 1 GB fijo de almacenamiento y solo permite **una base gratuita por workspace**.

El proyecto tiene dos fechas clave: el **11 de noviembre** (3C) y el **14 de noviembre** (Demo). Después de esas fechas la fundación debe poder seguir operando.

### Fechas de vencimiento según el día de creación

| Creada el | Vence el | Se borra el (sin pasar a pago) |
|---|---|---|
| 24 oct 2026 | 23 nov 2026 | 7 dic 2026 |
| 27 oct 2026 | 26 nov 2026 | 10 dic 2026 |
| 31 oct 2026 | 30 nov 2026 | 14 dic 2026 |

Cualquier base creada a partir del 15 de octubre llega al 14 de noviembre sin vencer. Si hay que recrearla, el plazo de 30 días vuelve a empezar desde la nueva fecha.

## Opciones comparadas

Precios oficiales consultados el 23 de octubre de 2026. Conversión con la TRM del 21 de octubre de 2026: **$3.163,76 COP por dólar**.

| Opción | Costo mensual (USD) | Costo mensual (COP aprox.) | Vencimiento | Respaldos | Observaciones |
|---|---|---|---|---|---|
| **Render Free** | $0 | $0 | 30 días + 14 de gracia | No | 1 GB. Una por workspace. Render puede reiniciarla sin aviso. |
| **Render Basic-256mb** | $6 + $0,30 por GB (≈ $6,30 con 1 GB) | ≈ $19.900 | No vence | PITR de 3 días (workspace Hobby) | 256 MB de RAM, 100 conexiones. Misma plataforma que el backend. |
| Render Basic-256mb + web service Starter | ≈ $13,30 | ≈ $42.100 | No vence | PITR de 3 días | El Starter ($7) evita que la API se apague tras 15 minutos sin uso (ver #57). |
| Neon Free | $0 | $0 | No vence | Historial de 6 horas | 1 GB y 100 CU-horas al mes. Se suspende tras 5 minutos sin uso. Otro proveedor. |
| Neon Launch | Pago por uso, ≈ $3 a $5 con el uso esperado | ≈ $9.500 a $15.800 | No vence | Hasta 7 días de historial | La estimación supone 1 GB y unas 30 CU-horas al mes. |
| Supabase Free | $0 | $0 | Se pausa tras 1 semana sin uso | No | 500 MB. |
| Supabase Pro | $25 | ≈ $79.100 | No vence | Diarios, 7 días | Incluye autenticación y almacenamiento que el MVP no usa. |

Todas las opciones pagas cumplen RNF-008. Incluso con un dólar a $4.500, la opción de Render con el web service Starter costaría unos $59.900 COP al mes.

## Decisión propuesta

1. **Hasta la Demo (14 de noviembre): Render Free.** La base se crea cuando se despliegue el backend (#28). Si se crea el 24 de octubre, vence el 23 de noviembre: quedan 9 días de margen después de la Demo, sin costo.
2. **Antes de que venza y para la operación de la fundación: pasar la misma base a Render Basic-256mb.** Render permite el cambio sin perder datos. Cuesta unos **$19.900 COP al mes**, o unos **$42.100 COP al mes** con el web service Starter. Se mantiene una sola plataforma, como dice el plan técnico, y se gana PITR de 3 días.
3. **Alternativa sin costo: Neon Free.** Si la fundación no puede asumir el pago, se migra la base a Neon. Solo cambia `DATABASE_URL`: las migraciones de Alembic funcionan igual. Las desventajas son agregar un proveedor, la reactivación tras 5 minutos sin uso y un historial de solo 6 horas.

Se descarta Supabase. Su plan gratuito se pausa tras una semana sin uso y solo tiene 500 MB. Su plan pago es el más caro e incluye servicios que el MVP no usa.

## Consecuencias

- Hay que **registrar la fecha real de creación de la base** en este ADR cuando se haga #28. También hay que poner un recordatorio para pasarla a pago **antes** de la fecha de vencimiento.
- En el plan gratuito no hay respaldos gestionados. Mientras tanto, #56 (respaldo con `pg_dump`) es la única protección de los datos.
- Solo se permite una base gratuita por workspace. Las pruebas no deben crear una segunda base en el mismo workspace de Render.
- El pago mensual queda a cargo de la fundación desde que la base pase al plan pago. El Product Owner debe confirmar quién paga y con qué medio de pago antes de la fecha de vencimiento.

## Fuentes

- Límites del plan gratuito de Render: https://render.com/docs/free
- Precios de Render (Postgres, web services y PITR): https://render.com/pricing
- Precios de Neon: https://neon.com/pricing
- Precios de Supabase: https://supabase.com/pricing
- TRM del 21 de octubre de 2026: https://www.portafolio.co/economia/finanzas/precio-del-dolar-hoy-en-colombia-la-divisa-inicia-cerca-de-3-160-este-21-de-octubre-504832
