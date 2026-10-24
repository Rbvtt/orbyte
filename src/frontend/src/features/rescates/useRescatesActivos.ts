"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rescatesApi } from "@/services/api/endpoints";
import type { RescateResumen } from "@/types/api";

type Estado = {
  rescates: RescateResumen[] | null;
  error: string | null;
  actualizadoEn: Date | null;
  cargando: boolean;
};

/** Listado de activos (#38). Se actualiza al volver a la pestaña y con el botón «Actualizar». */
export function useRescatesActivos() {
  const [estado, setEstado] = useState<Estado>({ rescates: null, error: null, actualizadoEn: null, cargando: true });
  const control = useRef<AbortController | null>(null);

  const cargar = useCallback(async () => {
    control.current?.abort();
    const actual = new AbortController();
    control.current = actual;
    try {
      const rescates = await rescatesApi.activos(actual.signal);
      setEstado({ rescates, error: null, actualizadoEn: new Date(), cargando: false });
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      // Si ya había datos se conservan: la pantalla muestra el error sin vaciarse.
      setEstado((e) => ({ ...e, error: (error as Error).message, cargando: false }));
    }
  }, []);

  const actualizar = useCallback(() => {
    setEstado((e) => ({ ...e, cargando: true }));
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

/** Reloj de la pantalla: el tiempo restante se recalcula cada 30 segundos. */
export function useAhora(intervaloMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}
