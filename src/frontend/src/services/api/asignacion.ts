import type { Organizacion, RescateAsignado, Voluntario } from "@/types/asignacion";
import { apiFetch } from "./client";

export const asignacionApi = {
  /** PATCH /api/v1/rescates/{id}/asignacion (#10). 409 si ya no está disponible. */
  asignar: (id: string, organizacionId: string, voluntarioId: string) =>
    apiFetch<RescateAsignado>(`/api/v1/rescates/${id}/asignacion`, {
      method: "PATCH",
      body: { organizacion_id: organizacionId, voluntario_id: voluntarioId },
    }),
  /** GET /api/v1/organizaciones (#10): capacidad, refrigeración y horario para comparar. */
  organizaciones: () => apiFetch<Organizacion[]>("/api/v1/organizaciones"),
  /** GET /api/v1/voluntarios (#10): voluntarios activos. */
  voluntarios: () => apiFetch<Voluntario[]>("/api/v1/voluntarios"),
};
