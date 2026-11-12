export type MetricaImpacto = "kg" | "personas" | "organizaciones" | "sin_kg";

export interface OrganizacionImpacto {
  id: string;
  nombre: string;
}

export interface RescateImpactoDetalle {
  id: string;
  entregado_en: string;
  comercio: string;
  organizacion_id: string;
  organizacion: string;
  cantidad_recibida: number;
  unidad_recibida: "kg" | "aproximada";
  es_medida: boolean;
  personas_beneficiadas: number | null;
  valor: number | null;
}

export interface OrganizacionImpactoDetalle {
  id: string;
  nombre: string;
  valor: number;
  rescates: RescateImpactoDetalle[];
}

export interface ImpactoResumen {
  kg_total: number;
  personas_total: number;
  organizaciones: OrganizacionImpacto[];
  rescates_sin_kg: number;
}

export interface ImpactoDetalle {
  metrica: MetricaImpacto;
  total: number;
  rescates: RescateImpactoDetalle[];
  organizaciones: OrganizacionImpactoDetalle[];
}
