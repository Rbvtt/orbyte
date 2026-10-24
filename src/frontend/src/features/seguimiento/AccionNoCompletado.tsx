"use client";

import { useId, useState } from "react";
import { ApiError } from "@/services/api/client";
import { seguimientoApi } from "@/services/api/endpoints";
import type { RescateSeguimiento } from "@/types/api";
import styles from "./Acciones.module.css";

type Paso = "inicio" | "confirmando" | "enviando";

/** #44 · Marcar como no completado con motivo obligatorio (CA-03.4). */
export function AccionNoCompletado({
  rescate,
  alCambiar,
  alConflicto,
}: {
  rescate: RescateSeguimiento;
  alCambiar: (r: RescateSeguimiento) => void;
  alConflicto: () => void;
}) {
  const [paso, setPaso] = useState<Paso>("inicio");
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) {
      setErrorMotivo("Escribe por qué no se pudo hacer el rescate.");
      return;
    }
    setPaso("enviando");
    setError(null);
    try {
      alCambiar(await seguimientoApi.marcarNoCompletado(rescate.id, motivo.trim()));
    } catch (err) {
      setPaso("confirmando");
      if (err instanceof ApiError && err.status === 422) {
        setErrorMotivo(err.erroresPorCampo.find((c) => c.campo === "motivo")?.mensaje ?? err.message);
        return;
      }
      setError((err as Error).message);
      if (err instanceof ApiError && err.status === 409) alConflicto();
    }
  }

  if (paso === "inicio") {
    return (
      <button type="button" className="btn btn--secondary btn--block" onClick={() => setPaso("confirmando")}>
        Marcar como no completado
      </button>
    );
  }

  const enviando = paso === "enviando";
  return (
    <form className={styles.confirmacion} onSubmit={confirmar} noValidate>
      <p className={styles.pregunta}>Este rescate quedará cerrado como no completado.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor={id} className="field__label">
          Motivo
        </label>
        <textarea
          id={id}
          className="textarea"
          maxLength={500}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            if (errorMotivo) setErrorMotivo(null);
          }}
          aria-invalid={errorMotivo ? true : undefined}
          aria-describedby={errorMotivo ? `${id}-error` : undefined}
          autoFocus
        />
        {errorMotivo && (
          <p id={`${id}-error`} className="field__error">
            {errorMotivo}
          </p>
        )}
      </div>
      <div className={styles.botones}>
        <button type="submit" className="btn btn--primary" disabled={enviando} aria-busy={enviando}>
          {enviando ? "Guardando…" : "Confirmar"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setPaso("inicio")} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
