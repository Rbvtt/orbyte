/**
 * Periodo de la consulta de impacto (CMP-05 · #52). Fechas de calendario en hora de Colombia,
 * `AAAA-MM-DD`, ambas incluidas (así las recibe GET /api/v1/impacto, #51).
 */
import type { MetricaImpacto } from "@/types/impacto";

export interface Periodo {
  desde: string;
  hasta: string;
}

export const METRICAS_VALIDAS: MetricaImpacto[] = ["kg", "personas", "organizaciones", "sin_kg"];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** Mes en curso hasta hoy: el periodo con el que abre la vista. */
export function periodoPorDefecto(): Periodo {
  const hoy = hoyColombia();
  return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
}

export function esFechaIso(valor: string | null | undefined): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/** Periodo válido leído de la URL, o `null` si falta o no es válido. */
export function leerPeriodo(params: { get(nombre: string): string | null }): Periodo | null {
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  if (!esFechaIso(desde) || !esFechaIso(hasta) || desde > hasta) return null;
  return { desde, hasta };
}

export function consultaPeriodo(periodo: Periodo, metrica?: MetricaImpacto): string {
  const params = new URLSearchParams();
  if (metrica) params.set("metrica", metrica);
  params.set("desde", periodo.desde);
  params.set("hasta", periodo.hasta);
  return params.toString();
}

function partes(fecha: string) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return { anio, mes: mes - 1, dia };
}

/** «01 sep — 30 sep 2026» (encabezado «Periodo consultado» del diseño #19). */
export function textoPeriodo({ desde, hasta }: Periodo): string {
  const a = partes(desde);
  const b = partes(hasta);
  const dd = (n: number) => String(n).padStart(2, "0");
  const inicio = `${dd(a.dia)} ${MESES_CORTOS[a.mes]}${a.anio !== b.anio ? ` ${a.anio}` : ""}`;
  const fin = `${dd(b.dia)} ${MESES_CORTOS[b.mes]} ${b.anio}`;
  return desde === hasta ? fin : `${inicio} — ${fin}`;
}

/** «Del 1 al 31 de agosto de 2026» (mensaje del estado vacío, #21). */
export function textoPeriodoLargo({ desde, hasta }: Periodo): string {
  const a = partes(desde);
  const b = partes(hasta);
  if (desde === hasta) return `El ${b.dia} de ${MESES[b.mes]} de ${b.anio}`;
  if (a.anio !== b.anio) {
    return `Del ${a.dia} de ${MESES[a.mes]} de ${a.anio} al ${b.dia} de ${MESES[b.mes]} de ${b.anio}`;
  }
  if (a.mes !== b.mes) return `Del ${a.dia} de ${MESES[a.mes]} al ${b.dia} de ${MESES[b.mes]} de ${b.anio}`;
  return `Del ${a.dia} al ${b.dia} de ${MESES[b.mes]} de ${b.anio}`;
}
