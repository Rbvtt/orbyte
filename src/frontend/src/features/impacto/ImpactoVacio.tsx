"use client";

import { IconoCalendario } from "@/components/ui/Iconos";
import type { ImpactoResumen } from "@/types/impacto";
import { type Periodo, textoPeriodoLargo } from "./periodo";
import styles from "./ImpactoVacio.module.css";

/** Sin rescates entregados no hay ninguna organización receptora en el periodo (#51). */
export function esPeriodoSinEntregas(resumen: ImpactoResumen): boolean {
  return resumen.organizaciones.length === 0 && resumen.kg_total === 0 && resumen.personas_total === 0;
}

/**
 * #21 · CA-05.3 (RF-018, RF-019). Estado vacío del impacto según el diseño #19: los tres totales ya
 * muestran 0 y este bloque explica, con el rango consultado, que no hubo entregas.
 */
export function ImpactoVacio({ periodo, campoInicio }: { periodo: Periodo; campoInicio: string }) {
  function cambiarFechas() {
    const campo = document.getElementById(campoInicio);
    campo?.scrollIntoView({ behavior: "smooth", block: "center" });
    campo?.focus({ preventScroll: true });
  }

  return (
    <section className={`panel ${styles.vacio}`} aria-labelledby="impacto-vacio-titulo" role="status">
      <span className={styles.icono}>
        <IconoCalendario tamano={22} />
      </span>
      <h2 id="impacto-vacio-titulo">No hubo entregas en este periodo</h2>
      <p>
        {textoPeriodoLargo(periodo)} no hay rescates entregados. Los tres indicadores muestran cero.
      </p>
      <button type="button" className={styles.cambiar} onClick={cambiarFechas}>
        <span aria-hidden="true">↑</span> Cambia las fechas y pulsa Consultar
      </button>
      <p className={styles.nota}>0 rescates con cantidades estimadas.</p>
    </section>
  );
}
