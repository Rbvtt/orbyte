"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rescatesApi } from "@/services/api/rescates";
import type { RescateDetalle, RescateLista } from "@/types/rescates";

/** Fila de la tabla: el listado (#37) más alimento, cantidad y hora de asignación del detalle. */
export type FilaRescate = RescateLista & Pick<RescateDetalle, "alimento" | "cantidad_aprox" | "asignado_en">;

type Estado = {
  rescates: FilaRescate[] | null;
  error: string | null;
  actualizadoEn: Date | null;
};

/**
 * Rescates activos (#38): GET /api/v1/rescates?estado=activos (#37). Se actualiza al volver a la
 * pestaña y con «Reintentar» si falla.
 *
 * El listado no trae alimento ni cantidad, que el diseño de #14 muestra en la primera columna;
 * se completan con el detalle de cada rescate.
 * TODO(#37): si el listado llega a incluir `alimento` y `cantidad_aprox`, quitar estas consultas.
 */
export function useRescatesActivos() {
  const [estado, setEstado] = useState<Estado>({ rescates: null, error: null, actualizadoEn: null });
  const control = useRef<AbortController | null>(null);

  const cargar = useCallback(async () => {
    control.current?.abort();
    const actual = new AbortController();
    control.current = actual;
    try {
      const lista = await rescatesApi.activos(actual.signal);
      const rescates = await Promise.all(
        lista.map(async (r): Promise<FilaRescate> => {
          try {
            const { alimento, cantidad_aprox, asignado_en } = await rescatesApi.detalle(r.id, actual.signal);
            return { ...r, alimento, cantidad_aprox, asignado_en };
          } catch (error) {
            if ((error as Error).name === "AbortError") throw error;
            return r; // Sin el detalle la fila se muestra igual, con lo que trae el listado.
          }
        }),
      );
      setEstado({ rescates, error: null, actualizadoEn: new Date() });
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      // Si ya había datos se conservan: la pantalla muestra el error sin vaciarse.
      setEstado((e) => ({ ...e, error: (error as Error).message }));
    }
  }, []);

  const actualizar = useCallback(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    void cargar();
    const alVolver = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      control.current?.abort();
    };
  }, [cargar]);

  return { ...estado, actualizar };
}
