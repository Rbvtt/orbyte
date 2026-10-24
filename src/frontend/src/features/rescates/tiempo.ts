/**
 * El tiempo es lo que más importa en un rescate: el alimento deja de servir en 2 a 4 horas
 * (hora y media en panadería). Estas funciones, sin React, se prueban en tests/frontend.
 */

import type { RescateResumen } from "@/types/api";

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

export type Hallazgo = {
  pendientes: number;
  masUrgente: RescateResumen | null;
  restanteMasUrgente: Restante | null;
};

/** El dato que la fundación necesita primero: cuántos faltan por asignar y cuál vence antes. */
export function hallazgo(rescates: RescateResumen[], ahora: Date = new Date()): Hallazgo {
  const pendientes = rescates
    .filter((r) => r.pendiente_asignar)
    .sort((a, b) => new Date(a.hora_limite).getTime() - new Date(b.hora_limite).getTime());
  const masUrgente = pendientes[0] ?? null;
  return {
    pendientes: pendientes.length,
    masUrgente,
    restanteMasUrgente: masUrgente ? restante(masUrgente.hora_limite, ahora) : null,
  };
}
