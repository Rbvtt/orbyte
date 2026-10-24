/**
 * Qué acción ve cada quien en el detalle del rescate. Sin React: se puede probar aparte.
 * La API vuelve a validar todo (403 / 409); esto solo decide qué botones mostrar.
 */

import type { RescateSeguimiento, UsuarioActual } from "@/types/api";

/** #45 · CA-04.1: solo el voluntario asignado y solo si el rescate está asignado. */
export function puedeRegistrarRecogida(usuario: UsuarioActual, rescate: RescateSeguimiento): boolean {
  return usuario.rol === "voluntario" && rescate.voluntario_id === usuario.id && rescate.estado === "asignado";
}

/** #44 · CA-03.4: la fundación, desde disponible o asignado. */
export function puedeMarcarNoCompletado(usuario: UsuarioActual, rescate: RescateSeguimiento): boolean {
  return usuario.rol === "fundacion" && (rescate.estado === "disponible" || rescate.estado === "asignado");
}
