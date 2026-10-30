"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api/client";
import { rescatesApi } from "@/services/api/rescates";
import type { RescateDetalle } from "@/types/rescates";

type Datos = { rescate: RescateDetalle };
export type ErrorDetalle = { status: number | null; mensaje: string };

async function cargarTodo(id: string): Promise<Datos> {
  return { rescate: await rescatesApi.detalle(id) };
}

function aError(error: unknown): ErrorDetalle {
  return { status: error instanceof ApiError ? error.status : null, mensaje: (error as Error).message };
}

/** Detalle del rescate (#12): GET /api/v1/rescates/{id} (#37). */
export function useDetalleRescate(id: string) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<ErrorDetalle | null>(null);

  useEffect(() => {
    let vigente = true;
    cargarTodo(id)
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setError(null);
      })
      .catch((e: unknown) => vigente && setError(aError(e)));
    return () => {
      vigente = false;
    };
  }, [id]);

  const recargar = useCallback(async () => {
    try {
      setDatos(await cargarTodo(id));
      setError(null);
    } catch (e) {
      setDatos(null);
      setError(aError(e));
    }
  }, [id]);

  return { datos, error, recargar };
}
