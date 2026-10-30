/** #37 · Consulta de rescates (app/schemas/rescates.py). */

import type { EstadoRescate } from "./api";

/** GET /api/v1/rescates?estado=activos (RescateListaOut). */
export interface RescateLista {
  id: string;
  estado: EstadoRescate;
  hora_limite: string;
  comercio: string;
  organizacion: string | null;
  voluntario: string | null;
  pendiente_asignar: boolean;
}

/**
 * GET /api/v1/rescates/{id} (RescateDetalleOut, sin los campos vacíos). Los campos dependen del
 * rol: el voluntario asignado recibe los datos del traslado (lugar_recogida, hora_limite,
 * cantidad_aprox, lugar_entrega) pero no alimento ni comercio.
 */
export interface RescateDetalle {
  id: string;
  estado: EstadoRescate;
  pendiente_asignar: boolean;
  hora_limite?: string;
  comercio?: string;
  alimento?: string;
  cantidad_aprox?: string;
  lugar_recogida?: string;
  /** Dirección de la organización receptora. */
  lugar_entrega?: string;
  organizacion?: string;
  voluntario?: string;
  asignado_en?: string | null;
  asignado_por?: string;
  observaciones?: string;
}
