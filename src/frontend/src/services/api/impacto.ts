import { apiFetch } from "./client";
import type { ImpactoDetalle, ImpactoResumen, MetricaImpacto } from "@/types/impacto";

export const impactoApi = {
  resumen: (desde: string, hasta: string) =>
    apiFetch<ImpactoResumen>(
      `/api/v1/impacto?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    ),
  detalle: (metrica: MetricaImpacto, desde: string, hasta: string) =>
    apiFetch<ImpactoDetalle>(
      `/api/v1/impacto/detalle?metrica=${metrica}&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    ),
};
