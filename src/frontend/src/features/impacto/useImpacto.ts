"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { impactoApi } from "@/services/api/endpoints";
import type { Impacto } from "@/types/api";
import { periodoPorDefecto, type Periodo } from "./periodo";

type Estado =
  | { tipo: "cargando"; periodo: Periodo }
  | { tipo: "listo"; periodo: Periodo; impacto: Impacto }
  | { tipo: "error"; periodo: Periodo; mensaje: string };

/** Totales de impacto (#52). La primera consulta es el mes en curso. */
export function useImpacto() {
  const [estado, setEstado] = useState<Estado>(() => ({ tipo: "cargando", periodo: periodoPorDefecto() }));
  const ultima = useRef(0);

  const pedir = useCallback((periodo: Periodo) => {
    const n = ++ultima.current;
    return impactoApi
      .totales(periodo.desde, periodo.hasta)
      .then((impacto) => n === ultima.current && setEstado({ tipo: "listo", periodo, impacto }))
      .catch((e: Error) => n === ultima.current && setEstado({ tipo: "error", periodo, mensaje: e.message }));
  }, []);

  useEffect(() => {
    void pedir(periodoPorDefecto());
  }, [pedir]);

  const consultar = useCallback(
    (periodo: Periodo) => {
      setEstado({ tipo: "cargando", periodo });
      void pedir(periodo);
    },
    [pedir],
  );

  return { estado, consultar };
}
