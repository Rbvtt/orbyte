/** #10 · Asignación y catálogos (app/schemas/rescates.py). */

import type { EstadoRescate } from "./api";

/** RescateAsignacionOut de PATCH /api/v1/rescates/{id}/asignacion. */
export interface RescateAsignado {
  id: string;
  estado: EstadoRescate;
  organizacion_id: string;
  voluntario_id: string;
  asignado_en: string;
  asignado_por: string;
}

/** OrganizacionOut de GET /api/v1/organizaciones. */
export interface Organizacion {
  id: string;
  nombre: string;
  capacidad_kg: number | null;
  refrigeracion: boolean;
  horario_recepcion: string | null;
}

/** VoluntarioOut de GET /api/v1/voluntarios. */
export interface Voluntario {
  id: string;
  nombre: string;
  medio_transporte: string | null;
  disponibilidad: string | null;
}
