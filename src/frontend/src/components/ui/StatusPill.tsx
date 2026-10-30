import type { EstadoRescate } from "@/types/api";
import { IconoCamion, IconoCheckCirculo, IconoPersonaCheck, IconoReloj, IconoXCirculo } from "./Iconos";

/** El estado se lee por el texto y el ícono, no solo por el color (#14). */
export const ETIQUETA_ESTADO: Record<EstadoRescate, string> = {
  disponible: "Pendiente de asignar",
  asignado: "Asignado",
  recogido: "Recogido",
  entregado: "Entregado",
  no_completado: "No completado",
};

const ICONO: Record<EstadoRescate, (p: { tamano?: number }) => React.ReactNode> = {
  disponible: IconoReloj,
  asignado: IconoPersonaCheck,
  recogido: IconoCamion,
  entregado: IconoCheckCirculo,
  no_completado: IconoXCirculo,
};

export function StatusPill({ estado }: { estado: EstadoRescate }) {
  const Icono = ICONO[estado];
  return (
    <span className={`pill pill--${estado}`}>
      <Icono tamano={14} />
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
