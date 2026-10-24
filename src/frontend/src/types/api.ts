/**
 * Contratos de la API (espejo de src/backend/app/api/schemas.py).
 * Si cambia el backend, se actualiza aquí primero. Próximo paso: generarlos desde /openapi.json.
 */

export type EstadoRescate = "disponible" | "asignado" | "recogido" | "entregado" | "no_completado";

export interface RescateCrear {
  alimento: string;
  cantidad_aprox: string;
  lugar_recogida: string;
  /** ISO 8601 con zona horaria, p. ej. 2026-10-23T18:30:00-05:00 */
  hora_limite: string;
  observaciones?: string;
}

export interface RescateResumen {
  id: string;
  numero: number;
  estado: EstadoRescate;
  pendiente_asignar: boolean;
  alimento: string;
  cantidad_aprox: string;
  comercio_id: string;
  comercio_nombre: string;
  lugar_recogida: string;
  hora_limite: string;
  organizacion_id: string | null;
  organizacion_nombre: string | null;
  voluntario_id: string | null;
  voluntario_nombre: string | null;
  creado_en: string;
}

export interface RescateDetalle extends RescateResumen {
  observaciones: string | null;
  organizacion_direccion: string | null;
  asignado_en: string | null;
  personas_beneficiadas: number | null;
}

export interface Organizacion {
  id: string;
  nombre: string;
  direccion: string;
  /** Decimal serializado como texto, p. ej. "80.00" */
  capacidad_kg: string | null;
  refrigeracion: boolean;
  horario_recepcion: string;
  puede_recoger: boolean;
}

export interface Voluntario {
  id: string;
  nombre: string;
  medio_transporte: string;
  disponibilidad: string;
}

export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export interface ErrorConflicto {
  detail: string;
  estado_actual: string;
  voluntario_actual: string | null;
}

/* ── Contratos de issues posteriores (#12, #44, #45, #52, #21) ─────────────────────────────
 * Se definieron desde las issues porque sus APIs aún no existen. Al integrar cada API,
 * confirmar los nombres con su esquema real.                                               */

export type Rol = "fundacion" | "voluntario" | "organizacion" | "comercio";

/** Usuario con sesión. TODO(#40): confirmar con la respuesta de GET /api/v1/auth/me. */
export interface UsuarioActual {
  id: string;
  nombre: string;
  rol: Rol;
  organizacion_id: string | null;
  comercio_id: string | null;
}

/** Detalle con lo que necesitan las acciones de seguimiento.
 *  TODO(#37, #44): confirmar que GET /api/v1/rescates/{id} incluya `recogido_en` y `motivo_no_completado`. */
export interface RescateSeguimiento extends RescateDetalle {
  recogido_en?: string | null;
  motivo_no_completado?: string | null;
}

/** Totales de un periodo (CA-05.1). TODO(#51): confirmar con la respuesta de GET /api/v1/impacto. */
export interface Impacto {
  /** Fechas YYYY-MM-DD, incluidas las dos. */
  desde: string;
  hasta: string;
  /** Decimal serializado como texto, p. ej. "35.0" */
  kg_rescatados: string;
  personas_beneficiadas: number;
  organizaciones_receptoras: number;
}

export type TotalImpacto = "kg" | "personas" | "organizaciones";
