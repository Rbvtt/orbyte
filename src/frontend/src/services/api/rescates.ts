import type { RescateDetalle, RescateLista } from "@/types/rescates";
import { apiFetch } from "./client";

export const rescatesApi = {
  /** GET /api/v1/rescates?estado=activos (#37): disponibles, asignados y recogidos. Solo fundación. */
  activos: (signal?: AbortSignal) => apiFetch<RescateLista[]>("/api/v1/rescates?estado=activos", { signal }),
  /** GET /api/v1/rescates/{id} (#37). Los campos dependen del rol; sin permiso responde 404. */
  detalle: (id: string, signal?: AbortSignal) => apiFetch<RescateDetalle>(`/api/v1/rescates/${id}`, { signal }),
  /** POST /api/v1/rescates/{id}/no-completado (#44). Solo fundación. */
  noCompletado: (id: string, motivo: string) =>
    apiFetch<{ id: string; estado: "no_completado"; motivo_no_completado: string }>(
      `/api/v1/rescates/${id}/no-completado`,
      { method: "POST", body: { motivo } },
    ),
};
