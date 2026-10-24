"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api/client";
import { catalogosApi, rescatesApi } from "@/services/api/endpoints";
import type { ErrorConflicto, Organizacion, RescateDetalle, Voluntario } from "@/types/api";

type Datos = { rescate: RescateDetalle; organizaciones: Organizacion[]; voluntarios: Voluntario[] };

export type ResultadoAsignacion =
  | { tipo: "inactivo" }
  | { tipo: "enviando" }
  | { tipo: "exito" }
  /** CA-02.2: alguien lo asignó primero. La pantalla se recarga con el estado real. */
  | { tipo: "conflicto"; mensaje: string }
  | { tipo: "error"; mensaje: string };

async function cargarTodo(rescateId: string): Promise<Datos> {
  const [rescate, organizaciones, voluntarios] = await Promise.all([
    rescatesApi.detalle(rescateId),
    catalogosApi.organizaciones(),
    catalogosApi.voluntarios(),
  ]);
  return { rescate, organizaciones, voluntarios };
}

/** Pantalla de asignación (#39): carga el rescate y los catálogos, y maneja el 409. */
export function useAsignacion(rescateId: string) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoAsignacion>({ tipo: "inactivo" });

  const cargar = useCallback(async () => {
    try {
      setDatos(await cargarTodo(rescateId));
      setErrorCarga(null);
    } catch (error) {
      setErrorCarga((error as Error).message);
    }
  }, [rescateId]);

  useEffect(() => {
    let vigente = true;
    cargarTodo(rescateId)
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setErrorCarga(null);
      })
      .catch((error: Error) => vigente && setErrorCarga(error.message));
    return () => {
      vigente = false;
    };
  }, [rescateId]);

  const asignar = useCallback(
    async (organizacionId: string, voluntarioId: string) => {
      setResultado({ tipo: "enviando" });
      try {
        const rescate = await rescatesApi.asignar(rescateId, organizacionId, voluntarioId);
        setDatos((d) => (d ? { ...d, rescate } : d));
        setResultado({ tipo: "exito" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const cuerpo = error.cuerpo as ErrorConflicto;
          setResultado({
            tipo: "conflicto",
            mensaje: cuerpo.voluntario_actual
              ? `Alguien lo asignó primero: este rescate ya está asignado a ${cuerpo.voluntario_actual}. Abajo ves cómo quedó.`
              : `${cuerpo.detail} Abajo ves su estado actual.`,
          });
          await cargar();
        } else {
          setResultado({ tipo: "error", mensaje: (error as Error).message });
        }
      }
    },
    [rescateId, cargar],
  );

  return { datos, errorCarga, resultado, asignar, recargar: cargar };
}
