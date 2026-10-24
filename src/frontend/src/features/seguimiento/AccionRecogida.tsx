"use client";

import { useState } from "react";
import { ApiError } from "@/services/api/client";
import { seguimientoApi } from "@/services/api/endpoints";
import type { RescateSeguimiento } from "@/types/api";
import styles from "./Acciones.module.css";

type Paso = "inicio" | "confirmando" | "enviando";

/** #45 · «Registrar recogida» (CA-04.1): confirmación dentro de la página, botón deshabilitado mientras envía. */
export function AccionRecogida({
  rescate,
  alCambiar,
  alConflicto,
}: {
  rescate: RescateSeguimiento;
  alCambiar: (r: RescateSeguimiento) => void;
  alConflicto: () => void;
}) {
  const [paso, setPaso] = useState<Paso>("inicio");
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setPaso("enviando");
    setError(null);
    try {
      alCambiar(await seguimientoApi.registrarRecogida(rescate.id));
    } catch (e) {
      setPaso("confirmando");
      setError((e as Error).message);
      // 409: el estado cambió mientras tanto; se recarga para mostrar el real.
      if (e instanceof ApiError && e.status === 409) alConflicto();
    }
  }

  if (paso === "inicio") {
    return (
      <button type="button" className="btn btn--primary btn--block" onClick={() => setPaso("confirmando")}>
        Registrar recogida
      </button>
    );
  }

  const enviando = paso === "enviando";
  return (
    <div className={styles.confirmacion} role="group" aria-labelledby="recogida-pregunta">
      <p id="recogida-pregunta" className={styles.pregunta}>
        ¿Ya recogiste {rescate.alimento.toLowerCase()} en {rescate.comercio_nombre}?
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.botones}>
        <button type="button" className="btn btn--primary" onClick={() => void confirmar()} disabled={enviando} aria-busy={enviando}>
          {enviando ? "Registrando…" : "Sí, ya lo recogí"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setPaso("inicio")} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
