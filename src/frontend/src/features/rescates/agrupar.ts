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

export const ESTADOS_ACTIVOS: EstadoRescate[] = ["disponible", "asignado", "recogido"];

export const GRUPO: Partial<Record<EstadoRescate, { titulo: string; descripcion: string; resumen: string }>> = {
  disponible: { titulo: "Pendiente de asignar", descripcion: "Requieren voluntario · prioridad por hora límite", resumen: "" },
  asignado: { titulo: "Asignado", descripcion: "Voluntario confirmado · recogida pendiente", resumen: "En espera de recogida" },
  recogido: { titulo: "Recogido", descripcion: "En traslado · entrega pendiente", resumen: "En camino al destino" },
};

export type Grupo = { estado: EstadoRescate; rescates: FilaRescate[] };

const sinTildes = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Búsqueda por alimento, comercio o voluntario, y filtro por estado. */
export function filtrar(rescates: FilaRescate[], busqueda: string, estado: EstadoRescate | "todos"): FilaRescate[] {
  const q = sinTildes(busqueda.trim());
  return rescates.filter(
    (r) =>
      (estado === "todos" || r.estado === estado) &&
      (!q || [r.alimento ?? "", r.comercio, r.voluntario ?? ""].some((campo) => sinTildes(campo).includes(q))),
  );
}

/** Grupos en el orden del flujo; dentro de cada uno, la hora límite más cercana primero. */
export function agrupar(rescates: FilaRescate[]): Grupo[] {
  return ESTADOS_ACTIVOS.map((estado) => ({
    estado,
    rescates: rescates.filter((r) => r.estado === estado).sort((a, b) => a.hora_limite.localeCompare(b.hora_limite)),
  })).filter((g) => g.rescates.length > 0);
}

export function contar(rescates: FilaRescate[]): Partial<Record<EstadoRescate, number>> {
  const c: Partial<Record<EstadoRescate, number>> = { disponible: 0, asignado: 0, recogido: 0 };
  for (const r of rescates) c[r.estado] = (c[r.estado] ?? 0) + 1;
  return c;
}

/** Texto bajo «Pendiente de asignar»: cuántos vencen en menos de una hora (CA-03.2). */
export function resumenPendientes(rescates: FilaRescate[], ahora: Date): string {
  const pendientes = rescates.filter((r) => r.pendiente_asignar).map((r) => restante(r.hora_limite, ahora));
  if (pendientes.length === 0) return "Todos tienen voluntario";
  const urgentes = pendientes.filter((t) => t.urgente);
  if (urgentes.length === 0) return "Ninguno vence en la próxima hora";
  const primero = Math.min(...urgentes.map((t) => t.minutos));
  if (primero < 0) return urgentes.length === 1 ? "1 ya venció" : `${urgentes.length} vencen en menos de 1 h`;
  return urgentes.length === 1 ? `1 vence en ${duracion(primero)}` : `${urgentes.length} vencen en menos de 1 h`;
}

/** Segunda línea de la columna «Voluntario». */
export function detalleVoluntario(r: FilaRescate): string {
  if (r.estado === "disponible") return "Requiere voluntario";
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
