import type {
  Organizacion,
  RescateCrear,
  RescateDetalle,
  RescateResumen,
  Voluntario,
} from "@/types/api";
import { apiFetch } from "./client";

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
