import type { EstadoRescate } from "@/types/api";

/** El estado se lee por el texto, no por el color (#14). */
export const ETIQUETA_ESTADO: Record<EstadoRescate, string> = {
  disponible: "Pendiente de asignar",
  asignado: "Asignado",
  recogido: "Recogido",
  entregado: "Entregado",
  no_completado: "No completado",
};

export function StatusPill({ estado }: { estado: EstadoRescate }) {
  return <span className={`pill pill--${estado}`}>{ETIQUETA_ESTADO[estado]}</span>;
}
