"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, SinConexion } from "@/services/api/client";
import { rescatesApi } from "@/services/api/endpoints";
import type { RescateCrear, RescateDetalle } from "@/types/api";
import { erroresDesdeApi, type ErroresAviso } from "./validacion";

type Estado =
  | { tipo: "inactivo" }
  | { tipo: "enviando" }
  | { tipo: "error"; mensaje: string; errores: ErroresAviso }
  | { tipo: "exito"; rescate: RescateDetalle };

function nuevaClave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Envía el aviso. Si la conexión falla y la persona vuelve a tocar «Enviar» con los mismos
 * datos, se reutiliza la misma Idempotency-Key: el backend devuelve el mismo aviso en vez de
 * crear otro (RNF-003).
 */
export function useRegistrarAviso() {
  const [estado, setEstado] = useState<Estado>({ tipo: "inactivo" });
  const ultimo = useRef<{ payload: string; clave: string } | null>(null);

  const enviar = useCallback(async (payload: RescateCrear) => {
    const serializado = JSON.stringify(payload);
    if (!ultimo.current || ultimo.current.payload !== serializado) {
      ultimo.current = { payload: serializado, clave: nuevaClave() };
    }
    setEstado({ tipo: "enviando" });
    try {
      const rescate = await rescatesApi.registrar(payload, ultimo.current.clave);
      ultimo.current = null;
      setEstado({ tipo: "exito", rescate });
      return rescate;
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setEstado({ tipo: "error", mensaje: "Revisa los datos marcados.", errores: erroresDesdeApi(error.erroresPorCampo) });
      } else if (error instanceof SinConexion) {
        setEstado({ tipo: "error", mensaje: `${error.message} Tu aviso no se ha perdido: toca «Enviar aviso» otra vez.`, errores: {} });
      } else {
        setEstado({ tipo: "error", mensaje: (error as Error).message, errores: {} });
      }
      return null;
    }
  }, []);

  const reiniciar = useCallback(() => {
    ultimo.current = null;
    setEstado({ tipo: "inactivo" });
  }, []);

  return { estado, enviar, reiniciar };
}
