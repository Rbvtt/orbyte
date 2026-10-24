"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api/client";
import { seguimientoApi, sesionApi } from "@/services/api/endpoints";
import type { RescateSeguimiento, UsuarioActual } from "@/types/api";

type Datos = { rescate: RescateSeguimiento; usuario: UsuarioActual };
export type ErrorDetalle = { status: number | null; mensaje: string };

async function cargarTodo(id: string): Promise<Datos> {
  const [rescate, usuario] = await Promise.all([seguimientoApi.detalle(id), sesionApi.yo()]);
  return { rescate, usuario };
}

function aError(error: unknown): ErrorDetalle {
  return { status: error instanceof ApiError ? error.status : null, mensaje: (error as Error).message };
}

/** Detalle del rescate (#12) y el usuario que lo ve, para decidir las acciones (#44, #45). */
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

  /** Una acción devolvió el rescate actualizado: se muestra sin volver a pedirlo. */
  const reemplazar = useCallback((rescate: RescateSeguimiento) => {
    setDatos((d) => (d ? { ...d, rescate } : d));
  }, []);

  return { datos, error, recargar, reemplazar };
}
