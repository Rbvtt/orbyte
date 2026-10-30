/** #6 · POST /api/v1/rescates (app/schemas/rescates.py). */

import type { EstadoRescate } from "./api";

/** RescateCreate. */
export interface RescateCrear {
  comercio_id: string;
  alimento: string;
  cantidad_aprox: string;
  lugar_recogida: string;
  /** ISO 8601 con zona horaria, p. ej. 2026-10-30T18:00:00-05:00 */
  hora_limite: string;
  observaciones?: string | null;
}

/** RescateOut. */
export interface RescateCreado {
  id: string;
  comercio_id: string;
  alimento: string;
  cantidad_aprox: string;
  lugar_recogida: string;
  hora_limite: string;
  observaciones: string | null;
  estado: EstadoRescate;
  registrado_por: string;
  creado_en: string;
}
