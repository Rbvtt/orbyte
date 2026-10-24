import type {
  Impacto,
  Organizacion,
  RescateCrear,
  RescateDetalle,
  RescateResumen,
  RescateSeguimiento,
  UsuarioActual,
  Voluntario,
} from "@/types/api";
import { apiFetch } from "./client";
import { local } from "./local/api";
import { USAR_DATOS_LOCALES } from "./modo";

export const rescatesApi = {
  /** POST /api/v1/rescates (#6). La clave de idempotencia evita duplicar el aviso en un reintento. */
  registrar: (datos: RescateCrear, claveIdempotencia: string) =>
    apiFetch<RescateDetalle>("/api/v1/rescates", {
      method: "POST",
      body: datos,
      headers: { "Idempotency-Key": claveIdempotencia },
    }),
  activos: (signal?: AbortSignal) => apiFetch<RescateResumen[]>("/api/v1/rescates?estado=activos", { signal }),
  detalle: (id: string, signal?: AbortSignal) => apiFetch<RescateDetalle>(`/api/v1/rescates/${id}`, { signal }),
  /** PATCH /api/v1/rescates/{id}/asignacion (#10). 409 si otro ya lo asignó. */
  asignar: (id: string, organizacionId: string, voluntarioId: string) =>
    apiFetch<RescateDetalle>(`/api/v1/rescates/${id}/asignacion`, {
      method: "PATCH",
      body: { organizacion_id: organizacionId, voluntario_id: voluntarioId },
    }),
};

export const catalogosApi = {
  organizaciones: () => apiFetch<Organizacion[]>("/api/v1/organizaciones"),
  voluntarios: () => apiFetch<Voluntario[]>("/api/v1/voluntarios"),
};

/* ── Issues posteriores ────────────────────────────────────────────────────────────────────
 * Cada función tiene la llamada real y la local. Mientras USAR_DATOS_LOCALES sea true se usa la
 * local (ver services/api/modo.ts).                                                          */

export const sesionApi = {
  /** TODO(#40): GET /api/v1/auth/me. Quién ve el detalle decide qué acciones aparecen. */
  yo: (): Promise<UsuarioActual> => (USAR_DATOS_LOCALES ? local.yo() : apiFetch<UsuarioActual>("/api/v1/auth/me")),
};

export const seguimientoApi = {
  /** TODO(#37): GET /api/v1/rescates/{id}. 403 si el rol no puede verlo. (#12) */
  detalle: (id: string): Promise<RescateSeguimiento> =>
    USAR_DATOS_LOCALES ? local.detalle(id) : apiFetch<RescateSeguimiento>(`/api/v1/rescates/${id}`),
  /** TODO(#16): POST /api/v1/rescates/{id}/recogida. 403 otro voluntario, 409 si no está asignado. (#45) */
  registrarRecogida: (id: string): Promise<RescateSeguimiento> =>
    USAR_DATOS_LOCALES
      ? local.registrarRecogida(id)
      : apiFetch<RescateSeguimiento>(`/api/v1/rescates/${id}/recogida`, { method: "POST" }),
  /** TODO(#44 API): POST /api/v1/rescates/{id}/no-completado con {motivo}. 409 desde recogido o entregado. */
  marcarNoCompletado: (id: string, motivo: string): Promise<RescateSeguimiento> =>
    USAR_DATOS_LOCALES
      ? local.marcarNoCompletado(id, motivo)
      : apiFetch<RescateSeguimiento>(`/api/v1/rescates/${id}/no-completado`, { method: "POST", body: { motivo } }),
};

export const impactoApi = {
  /** TODO(#51): GET /api/v1/impacto?desde=YYYY-MM-DD&hasta=YYYY-MM-DD. (#52, #21) */
  totales: (desde: string, hasta: string): Promise<Impacto> =>
    USAR_DATOS_LOCALES
      ? local.impacto(desde, hasta)
      : apiFetch<Impacto>(`/api/v1/impacto?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
};
