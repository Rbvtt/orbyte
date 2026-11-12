import type {
  RescateAvisoComercio,
  RescateBeneficiados,
  RescateDetalle,
  RescateEntrega,
  RescateHistorial,
  RescateLista,
} from "@/types/rescates";
import { apiFetch } from "./client";

export const rescatesApi = {
  /** GET /api/v1/rescates?estado=activos (#37): disponibles, asignados y recogidos. Solo fundación. */
  activos: (signal?: AbortSignal) => apiFetch<RescateLista[]>("/api/v1/rescates?estado=activos", { signal }),
  /** Rescates activos asignados al voluntario autenticado o a su organización. */
  misAsignaciones: (signal?: AbortSignal) =>
    apiFetch<RescateLista[]>("/api/v1/rescates/mis-asignaciones", { signal }),
  marcarEntregado: (id: string) =>
    apiFetch<void>(`/api/v1/rescates/${id}/entrega-voluntario`, { method: "POST" }),
  confirmarRecepcion: (
    id: string,
    datos: { cantidad_recibida: number; unidad_recibida: string; es_medida: boolean; personas_beneficiadas?: number },
  ) => apiFetch<void>(`/api/v1/rescates/${id}/recepcion`, { method: "POST", body: datos }),
  confirmarEntrega: (
    id: string,
    datos: { recibido_por: string; cantidad_recibida: number; unidad: "kg" | "aprox"; es_medida: boolean },
  ) => apiFetch<RescateEntrega>(`/api/v1/rescates/${id}/entrega`, { method: "POST", body: datos }),
  actualizarBeneficiados: (id: string, personas_beneficiadas: number) =>
    apiFetch<RescateBeneficiados>(`/api/v1/rescates/${id}/beneficiados`, {
      method: "PATCH",
      body: { personas_beneficiadas },
    }),
  /** GET /api/v1/rescates/{id} (#37). Los campos dependen del rol; sin permiso responde 404. */
  detalle: (id: string, signal?: AbortSignal) => apiFetch<RescateDetalle>(`/api/v1/rescates/${id}`, { signal }),
  historial: (id: string, signal?: AbortSignal) =>
    apiFetch<RescateHistorial[]>(`/api/v1/rescates/${id}/historial`, { signal }),
  marcarNoCompletado: (id: string, motivo: string) =>
    apiFetch<RescateAvisoComercio>(`/api/v1/rescates/${id}/no-completado`, {
      method: "POST",
      body: { motivo },
    }),
  asignar: (id: string, datos: { organizacion_id: string; voluntario_id: string; motivo?: string }) =>
    apiFetch<{ id: string; estado: string; organizacion_id: string; voluntario_id: string }>(
      `/api/v1/rescates/${id}/asignacion`,
      { method: "PATCH", body: datos },
    ),
  misAvisos: (signal?: AbortSignal) =>
    apiFetch<RescateAvisoComercio[]>("/api/v1/rescates/mis-avisos", { signal }),
  actualizarAviso: (
    id: string,
    datos: Pick<RescateAvisoComercio, "alimento" | "cantidad_aprox" | "lugar_recogida" | "hora_limite" | "observaciones">,
  ) => apiFetch<RescateAvisoComercio>(`/api/v1/rescates/${id}`, { method: "PATCH", body: datos }),
  cancelarAviso: (id: string) =>
    apiFetch<RescateAvisoComercio>(`/api/v1/rescates/${id}/cancelar`, { method: "POST" }),
  /** POST /api/v1/rescates/{id}/no-completado (#44). Solo fundación. */
  noCompletado: (id: string, motivo: string) =>
    apiFetch<{ id: string; estado: "no_completado"; motivo_no_completado: string }>(
      `/api/v1/rescates/${id}/no-completado`,
      { method: "POST", body: { motivo } },
    ),
};
