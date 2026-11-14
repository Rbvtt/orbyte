"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api/client";
import { asignacionApi } from "@/services/api/asignacion";
import { rescatesApi } from "@/services/api/rescates";
import type { Organizacion, Voluntario } from "@/types/asignacion";
import type { RescateDetalle } from "@/types/rescates";

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
    asignacionApi.organizaciones(),
    asignacionApi.voluntarios(),
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
        await asignacionApi.asignar(rescateId, organizacionId, voluntarioId);
        // La respuesta trae los ids; el detalle trae los nombres que se muestran.
        await cargar();
        setResultado({ tipo: "exito" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          // La API responde «El rescate ya está asignado al voluntario <nombre>» (#10).
          setResultado({
            tipo: "conflicto",
            mensaje: `Alguien se adelantó: ${error.message.replace(/\.?$/, ".")} Abajo ves cómo quedó.`,
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
