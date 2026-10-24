/**
 * Interruptor de datos locales.
 *
 * Las pantallas de #12, #44, #45, #52 y #21 dependen de APIs que todavía no existen. Mientras
 * tanto funcionan con datos de ejemplo en memoria (services/api/local/), con las mismas
 * respuestas y errores que se esperan de la API real.
 *
 * TODO(#16, #37, #40, #44, #51): cuando esas APIs estén integradas en `main`, poner esto en
 * `false` y borrar la carpeta services/api/local/. Las llamadas reales ya están escritas en
 * endpoints.ts, justo al lado de cada llamada local.
 */
export const USAR_DATOS_LOCALES = true;
