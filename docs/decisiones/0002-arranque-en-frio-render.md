# ADR 0002 · Arranque en frío de la API en el plan gratuito de Render

- **Estado:** Propuesta, pendiente de aprobación del Product Owner
- **Fecha:** 2026-11-10
- **Issue:** #57
- **Requerimientos:** RNF-007, RNF-008

## Contexto

La API (`orbyte-api`) está en el plan gratuito de Render (#28). Render la apaga tras 15 minutos sin tráfico, y la primera petición después tiene que esperar a que vuelva a arrancar. El frontend está en Vercel y no tiene este problema.

### Medición

El 10 de noviembre de 2026 se dejó la API 21 minutos sin tráfico y luego se pidió `GET /health` tres veces seguidas desde Colombia con `curl`:

| Petición | Tiempo hasta el primer byte |
|---|---|
| 1.ª, con la API apagada | **42,9 s** |
| 2.ª | 0,32 s |
| 3.ª | 0,54 s |
| Frontend `/login` en Vercel | 0,78 s en total |

Render indica que la espera puede pasar de 50 segundos. Mientras dura, el login o la primera pantalla parecen colgados.

## Opciones

| Opción | Costo mensual | Efecto |
|---|---|---|
| A. Despertar la API a mano antes de usarla: abrir `https://orbyte-api-ecow.onrender.com/health` y esperar `{"status":"ok"}` | $0 | Elimina la espera en una sesión planeada (sesión 13, Demo). No sirve para el uso diario. |
| B. Mensaje de carga en el frontend ("Conectando con el servidor…") cuando una petición tarda más de unos segundos | $0 | La espera sigue, pero se entiende. Requiere un cambio en el frontend. |
| C. Llamar a `/health` cada 14 minutos desde un servicio externo | $0 | Mantiene la API encendida, pero depende de un tercero. Además, la base gratuita igual vence el 10 de diciembre (ADR 0001). |
| D. Web service **Starter** de Render | $7 USD (≈ $22.100 COP con la TRM del ADR 0001) | La API no se apaga. Con la base Basic-256mb suman ≈ $42.100 COP al mes, dentro de RNF-008. |

## Decisión propuesta

1. **Para la sesión 13 y la Demo del 14 de noviembre: opción A.** Entre 2 y 5 minutos antes de presentar, alguien del equipo abre `/health` y confirma `{"status":"ok"}`. Después abre `https://orbyte-dun.vercel.app`. Si nadie usa la API durante la presentación por más de 15 minutos, hay que repetir el paso.
2. **Para la operación de la fundación: opción D**, junto con el paso de la base a Basic-256mb del ADR 0001. Las dos cosas se pagan en la misma cuenta de Render y antes del 10 de diciembre de 2026.
3. **La opción B queda como mejora** del frontend si la fundación se queda en el plan gratuito.

Se descarta la opción C: agrega una dependencia externa solo para evitar un pago de $22.100 COP, y no resuelve el vencimiento de la base.

## Consecuencias

- Antes de la Demo hay que incluir el paso 1 en el guion de la presentación.
- El Product Owner debe confirmar el pago del Starter, junto con el de la base del ADR 0001.
- Si se pasa a Starter, hay que cambiar `plan: free` por `plan: starter` en `render.yaml` para que el Blueprint quede igual que el panel.

## Fuentes

- Límites del plan gratuito de Render: https://render.com/docs/free
- Precios de Render: https://render.com/pricing
