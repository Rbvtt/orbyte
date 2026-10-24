/**
 * Periodo de la consulta de impacto (#52, #21), en fechas de Bogotá. Sin React.
 */

import type { Impacto } from "@/types/api";

const CLAVE_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
const LARGA = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

export type Periodo = { desde: string; hasta: string };

/** Hoy en Bogotá, como YYYY-MM-DD. */
export function hoy(ahora: Date = new Date()): string {
  return CLAVE_DIA.format(ahora);
}

/** Del primer día del mes hasta hoy. */
export function periodoPorDefecto(ahora: Date = new Date()): Periodo {
  const h = hoy(ahora);
  return { desde: `${h.slice(0, 8)}01`, hasta: h };
}

export function validarPeriodo({ desde, hasta }: Periodo): string | null {
  if (!desde || !hasta) return "Elige la fecha inicial y la final.";
  if (desde > hasta) return "La fecha inicial debe ser anterior o igual a la final.";
  return null;
}

/** «1 de octubre de 2026 al 24 de octubre de 2026», o un solo día. */
export function textoPeriodo({ desde, hasta }: Periodo): string {
  const f = (d: string) => LARGA.format(new Date(`${d}T00:00:00Z`));
  return desde === hasta ? `el ${f(desde)}` : `del ${f(desde)} al ${f(hasta)}`;
}

/** CA-05.3: sin rescates entregados en el periodo, los tres totales son cero. */
export function sinEntregas(impacto: Impacto): boolean {
  return Number(impacto.kg_rescatados) === 0 && impacto.personas_beneficiadas === 0 && impacto.organizaciones_receptoras === 0;
}

export function formatoKg(valor: string): string {
  const n = Number(valor);
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0);
}
