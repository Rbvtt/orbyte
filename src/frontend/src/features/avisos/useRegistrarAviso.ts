"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, SinConexion } from "@/services/api/client";
import { avisosApi } from "@/services/api/avisos";
import type { RescateCrear, RescateCreado } from "@/types/avisos";
import { erroresDesdeApi, type ErroresAviso } from "./validacion";

type Estado =
  | { tipo: "inactivo" }
  | { tipo: "enviando" }
  /** `mensaje` vacío: el problema está en los campos y se muestra junto a cada uno. */
  | { tipo: "error"; mensaje: string }
  | { tipo: "exito"; rescate: RescateCreado };

type ResultadoEnvio = { tipo: "creado"; rescate: RescateCreado } | { tipo: "fallo"; errores: ErroresAviso };

function nuevaClave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Envía el aviso a POST /api/v1/rescates (#6). Si la conexión falla y la persona vuelve a
 * tocar «Registrar aviso» con los mismos datos, se reutiliza la misma Idempotency-Key: el
 * backend devuelve el mismo aviso en vez de crear otro. Si cambian los datos, la clave es nueva
 * (la API responde 409 si una clave se repite con otro contenido).
 */
export function useRegistrarAviso() {
  const [estado, setEstado] = useState<Estado>({ tipo: "inactivo" });
  const ultimo = useRef<{ payload: string; clave: string } | null>(null);

  const enviar = useCallback(async (payload: RescateCrear): Promise<ResultadoEnvio> => {
    const serializado = JSON.stringify(payload);
    if (!ultimo.current || ultimo.current.payload !== serializado) {
      ultimo.current = { payload: serializado, clave: nuevaClave() };
    }
    setEstado({ tipo: "enviando" });
    try {
      const rescate = await avisosApi.registrar(payload, ultimo.current.clave);
      ultimo.current = null;
      setEstado({ tipo: "exito", rescate });
      return { tipo: "creado", rescate };
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const { porCampo, generales } = erroresDesdeApi(error.erroresPorCampo);
        setEstado({ tipo: "error", mensaje: generales.join(" ") });
        return { tipo: "fallo", errores: porCampo };
      }
      if (error instanceof SinConexion) {
        setEstado({ tipo: "error", mensaje: `${error.message} Tu aviso no se ha perdido: toca «Registrar aviso» otra vez.` });
      } else {
        setEstado({ tipo: "error", mensaje: (error as Error).message });
      }
      return { tipo: "fallo", errores: {} };
    }
  }, []);

  const reiniciar = useCallback(() => {
    ultimo.current = null;
    setEstado({ tipo: "inactivo" });
  }, []);

  /** Un error que se muestra sin pasar por la API (por ejemplo, falta el comercio de la sesión). */
  const fallar = useCallback((mensaje: string) => setEstado({ tipo: "error", mensaje }), []);

  return { estado, enviar, reiniciar, fallar };
}
