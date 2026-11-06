import type { EstadoRescate } from "@/types/api";
import { IconoCamion, IconoCheckCirculo, IconoPersonaCheck, IconoReloj, IconoXCirculo } from "./Iconos";

type EstadoVisible = EstadoRescate | "no_disponible" | "por_recibir" | "entregado_por_voluntario" | "recibido";

/** El estado se lee por el texto y el ícono, no solo por el color (#14). */
export const ETIQUETA_ESTADO: Record<EstadoVisible, string> = {
  disponible: "Disponible",
  no_disponible: "No disponible",
  por_recibir: "Por recibir",
  entregado_por_voluntario: "Entregado",
  recibido: "Recibido",
  asignado: "Asignado",
  recogido: "Recogido",
  entregado: "Entregado",
  no_completado: "No completado",
};

const ICONO: Record<EstadoVisible, (p: { tamano?: number }) => React.ReactNode> = {
  disponible: IconoReloj,
  no_disponible: IconoXCirculo,
  por_recibir: IconoReloj,
  entregado_por_voluntario: IconoCamion,
  recibido: IconoCheckCirculo,
  asignado: IconoPersonaCheck,
  recogido: IconoCamion,
  entregado: IconoCheckCirculo,
  no_completado: IconoXCirculo,
};

export function StatusPill({ estado }: { estado: EstadoVisible }) {
  const Icono = ICONO[estado];
  return (
    <span className={`pill pill--${estado}`}>
      <Icono tamano={14} />
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
