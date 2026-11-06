/** #37 · Consulta de rescates (app/schemas/rescates.py). */

import type { EstadoRescate, RolUsuario } from "./api";

/** GET /api/v1/rescates?estado=activos (RescateListaOut). */
export interface RescateLista {
  id: string;
  estado: EstadoRescate;
  hora_limite: string;
  comercio: string;
  organizacion: string | null;
  voluntario: string | null;
  pendiente_asignar: boolean;
  origen_aviso: "comercio" | "fundacion";
  fundacion?: string | null;
  lugar_recogida?: string | null;
  lugar_entrega?: string | null;
  cantidad_aprox?: string | null;
  estado_visual?: EstadoVisualRescate;
}

export type EstadoVisualRescate =
  | "disponible"
  | "no_disponible"
  | "asignado"
  | "recogido"
  | "entregado"
  | "no_completado"
  | "por_recibir"
  | "entregado_por_voluntario"
  | "recibido";

/**
 * GET /api/v1/rescates/{id} (RescateDetalleOut, sin los campos vacíos). Los campos dependen del
 * rol: el voluntario asignado recibe los datos del traslado (lugar_recogida, hora_limite,
 * cantidad_aprox, lugar_entrega) pero no alimento ni comercio.
 */
export interface RescateDetalle {
  id: string;
  estado: EstadoRescate;
  organizacion_id?: string | null;
  voluntario_id?: string | null;
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
  fundacion?: string;
  estado_visual?: EstadoVisualRescate;
  asignado_en?: string | null;
  asignado_por?: string;
  observaciones?: string;
  origen_aviso?: "comercio" | "fundacion";
}

export interface RescateHistorial {
  id: number;
  estado_anterior: EstadoRescate | null;
  estado_nuevo: EstadoRescate;
  ocurrido_en: string;
  actor_id: string;
  actor_nombre: string;
  actor_rol: RolUsuario;
  detalle: Record<string, unknown>;
}

export interface RescateAvisoComercio {
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
  motivo_no_completado: string | null;
}
