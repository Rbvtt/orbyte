"use client";

import { useEffect, useState } from "react";
import { hora24 } from "@/features/rescates/tiempo";
import { rescatesApi } from "@/services/api/rescates";
import { sesionApi } from "@/services/api/sesionApi";
import type { RescateDetalle } from "@/types/rescates";
import styles from "./AccionRecogida.module.css";

/**
 * #45 · CA-04.1 (RF-012). Acción «Registrar recogida» del detalle /rescates/:id.
 * Solo se muestra al voluntario asignado mientras el rescate está `asignado`. La confirmación
 * está dentro de la página y el botón queda deshabilitado durante la petición (#16).
 */
export function AccionRecogida({ rescate, onRegistrada }: { rescate: RescateDetalle; onRegistrada: () => void }) {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [registradaEn, setRegistradaEn] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    sesionApi
      .me()
      .then((usuario) => {
        if (vigente && usuario.rol === "voluntario") setUsuarioId(usuario.id);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, []);

  const esAsignado = usuarioId !== null && rescate.voluntario_id === usuarioId;

  if (registradaEn) {
    return (
      <div className={`notice notice--success ${styles.bloque}`} role="status">
        <p>
          <strong>Recogida registrada</strong> a las {hora24(new Date(registradaEn))}. El rescate quedó como
          recogido.
        </p>
      </div>
    );
  }

  if (!esAsignado) return null;
  if (rescate.estado !== "asignado") {
    // Tras un 409 se recargó el detalle: se explica qué pasó con el estado actual a la vista.
    return error ? (
      <p className={`notice notice--warning ${styles.bloque}`} role="alert">
        {error}
      </p>
    ) : null;
  }

  async function registrar() {
    setEnviando(true);
    setError("");
    try {
      const recogida = await rescatesApi.registrarRecogida(rescate.id);
      setConfirmando(false);
      setRegistradaEn(recogida.recogido_en);
      onRegistrada();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la recogida.");
      setConfirmando(false);
      onRegistrada();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={`panel ${styles.bloque}`} aria-labelledby="recogida-titulo">
      <div className="panel__header">
        <h2 id="recogida-titulo" className={styles.titulo}>
          Recogida
        </h2>
      </div>
      <div className={styles.contenido}>
        <p className={styles.ayuda}>Cuando tengas la donación contigo, registra la recogida.</p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {confirmando ? (
          <div className={styles.confirmacion} role="alertdialog" aria-labelledby="confirmar-recogida">
            <p id="confirmar-recogida">
              <strong>¿Confirmas que ya recogiste la donación?</strong>
            </p>
            <p>Se guardará la fecha y hora de la recogida.</p>
            <div className={styles.botones}>
              <button type="button" className="btn btn--primary" disabled={enviando} onClick={() => void registrar()}>
                {enviando ? "Registrando…" : "Sí, registrar recogida"}
              </button>
              <button type="button" className="btn btn--secondary" disabled={enviando} onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setConfirmando(true)}>
            Registrar recogida
          </button>
        )}
      </div>
    </section>
  );
}
