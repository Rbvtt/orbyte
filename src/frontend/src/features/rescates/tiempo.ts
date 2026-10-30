/**
 * El tiempo es lo que más importa en un rescate: el alimento deja de servir en 2 a 4 horas
 * (hora y media en panadería). Funciones sin React, compartidas por las pantallas.
 */

const ZONA = "America/Bogota";
/** Por debajo de esto un rescate sin voluntario se marca como urgente. */
export const MINUTOS_URGENTE = 60;

const formatoHora = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit", hour12: true });
const formatoFecha = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "numeric", month: "short" });
const claveDia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

export function hora(iso: string): string {
  return formatoHora.format(new Date(iso)).replace(/\s/g, " ");
}

/** «hoy», «mañana» o «25 oct.», en el día de Bogotá. */
export function dia(iso: string, ahora: Date = new Date()): string {
  const d = claveDia.format(new Date(iso));
  if (d === claveDia.format(ahora)) return "hoy";
  if (d === claveDia.format(new Date(ahora.getTime() + 24 * 60 * 60 * 1000))) return "mañana";
  return formatoFecha.format(new Date(iso));
}

export function duracion(minutos: number): string {
  const m = Math.abs(Math.round(minutos));
  if (m < 60) return `${m} min`;
  if (m >= 24 * 60) {
    const d = Math.floor(m / (24 * 60));
    const h = Math.floor((m % (24 * 60)) / 60);
    return h === 0 ? `${d} d` : `${d} d ${h} h`;
  }
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto === 0 ? `${h} h` : `${h} h ${resto} min`;
}

export type Restante = { minutos: number; texto: string; vencido: boolean; urgente: boolean };

export function restante(iso: string, ahora: Date = new Date()): Restante {
  const minutos = (new Date(iso).getTime() - ahora.getTime()) / 60000;
  if (minutos < 0) return { minutos, texto: `venció hace ${duracion(minutos)}`, vencido: true, urgente: true };
  if (minutos < 1) return { minutos, texto: "vence ahora", vencido: false, urgente: true };
  return { minutos, texto: `quedan ${duracion(minutos)}`, vencido: false, urgente: minutos < MINUTOS_URGENTE };
}

/* ── Formatos de los diseños (#7, #14): hora de 24 h y fechas de Bogotá ── */

const HORA_24 = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, weekday: "long", day: "numeric", month: "short", year: "numeric" });
const FECHA_COMPLETA = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** «18:00» */
export function hora24(fecha: Date): string {
  return HORA_24.format(fecha);
}

/** «30/10/2026» */
export function fechaCorta(fecha: Date): string {
  return FECHA_CORTA.format(fecha);
}

/** «viernes, 30 oct 2026» (formulario de aviso, #7) */
export function fechaLarga(fecha: Date): string {
  return FECHA_LARGA.format(fecha).replace(/\./g, "").replace(/ de /g, " ");
}

/** «Viernes, 30 de octubre de 2026» (rescates activos, #14) */
export function fechaCompleta(fecha: Date): string {
  const texto = FECHA_COMPLETA.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
