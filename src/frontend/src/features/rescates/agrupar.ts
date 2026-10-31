/**
 * Cómo se organiza la tabla de «Rescates activos» según el diseño de #14: un grupo por estado,
 * cada grupo ordenado por hora límite, con búsqueda y filtro por estado. Sin React.
 *
 * GET /api/v1/rescates?estado=activos (#37) devuelve disponibles, asignados y recogidos. El
 * diseño también muestra los entregados y no completados del día.
 * TODO(#37): si la API llega a devolverlos, agregarlos a ESTADOS_ACTIVOS.
 */

import type { EstadoRescate } from "@/types/api";
import { duracion, hora24, restante } from "./tiempo";
import type { FilaRescate } from "./useRescatesActivos";

export type EstadoVisible = EstadoRescate | "no_disponible";

export const ESTADOS_ACTIVOS: EstadoVisible[] = ["disponible", "no_disponible", "asignado", "recogido"];

export const GRUPO: Partial<Record<EstadoVisible, { titulo: string; descripcion: string; resumen: string }>> = {
  disponible: { titulo: "Disponible", descripcion: "Requiere voluntario · dentro de la hora límite", resumen: "Pendientes de asignar" },
  no_disponible: { titulo: "No disponible", descripcion: "La hora límite venció · ya no se puede asignar", resumen: "Hora límite vencida" },
  asignado: { titulo: "Asignado", descripcion: "Voluntario confirmado · recogida pendiente", resumen: "En espera de recogida" },
  recogido: { titulo: "Recogido", descripcion: "En traslado · entrega pendiente", resumen: "En camino al destino" },
};

export type Grupo = { estado: EstadoVisible; rescates: FilaRescate[] };

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function estadoVisible(r: FilaRescate, ahora: Date): EstadoVisible {
  if (r.estado === "disponible" && restante(r.hora_limite, ahora).vencido) return "no_disponible";
  return r.estado;
}

/** Búsqueda por alimento, comercio o voluntario, y filtro por estado. */
export function filtrar(
  rescates: FilaRescate[],
  busqueda: string,
  estado: EstadoVisible | "todos",
  ahora: Date,
): FilaRescate[] {
  const q = sinTildes(busqueda.trim());
  return rescates.filter(
    (r) =>
      (estado === "todos" || estadoVisible(r, ahora) === estado) &&
      (!q || [r.alimento ?? "", r.comercio, r.voluntario ?? ""].some((campo) => sinTildes(campo).includes(q))),
  );
}

/** Grupos en el orden del flujo; dentro de cada uno, la hora límite más cercana primero. */
export function agrupar(rescates: FilaRescate[], ahora: Date): Grupo[] {
  return ESTADOS_ACTIVOS.map((estado) => ({
    estado,
    rescates: rescates
      .filter((r) => estadoVisible(r, ahora) === estado)
      .sort((a, b) => a.hora_limite.localeCompare(b.hora_limite)),
  })).filter((g) => g.rescates.length > 0);
}

export function contar(rescates: FilaRescate[], ahora: Date): Partial<Record<EstadoVisible, number>> {
  const c: Partial<Record<EstadoVisible, number>> = {
    disponible: 0,
    no_disponible: 0,
    asignado: 0,
    recogido: 0,
  };
  for (const r of rescates) {
    const estado = estadoVisible(r, ahora);
    c[estado] = (c[estado] ?? 0) + 1;
  }
  return c;
}

/** Texto bajo «Disponible»: cuántos rescates vencen en menos de una hora (CA-03.2). */
export function resumenPendientes(rescates: FilaRescate[], ahora: Date): string {
  const pendientes = rescates
    .filter((r) => r.pendiente_asignar && estadoVisible(r, ahora) === "disponible")
    .map((r) => restante(r.hora_limite, ahora));
  if (pendientes.length === 0) return "Ninguno pendiente de asignar";
  const urgentes = pendientes.filter((t) => t.urgente);
  if (urgentes.length === 0) return "Ninguno vence en la próxima hora";
  const primero = Math.min(...urgentes.map((t) => t.minutos));
  if (primero < 0) return urgentes.length === 1 ? "1 ya venció" : `${urgentes.length} vencen en menos de 1 h`;
  return urgentes.length === 1 ? `1 vence en ${duracion(primero)}` : `${urgentes.length} vencen en menos de 1 h`;
}

/** Segunda línea de la columna «Voluntario». */
export function detalleVoluntario(r: FilaRescate, ahora: Date): string {
  if (r.estado === "disponible") {
    return estadoVisible(r, ahora) === "no_disponible" ? "Hora límite vencida" : "Requiere voluntario";
  }
  if (r.estado === "asignado") return r.asignado_en ? `Confirmado · ${hora24(new Date(r.asignado_en))} h` : "Confirmado";
  return "En traslado";
}

/** Segunda línea de la columna «Hora límite». */
export function detalleHora(r: FilaRescate, ahora: Date): { texto: string; urgente: boolean } {
  if (r.estado !== "disponible") {
    return { texto: r.estado === "asignado" ? "Límite de recogida" : "Entrega pendiente", urgente: false };
  }
  const t = restante(r.hora_limite, ahora);
  return { texto: t.vencido ? t.texto.replace(/^v/, "V") : `Vence en ${duracion(t.minutos)}`, urgente: t.urgente };
}
