"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { referencia } from "@/features/rescates/referencia";
import { dia, fechaCompleta, hora, hora24, restante } from "@/features/rescates/tiempo";
import { useAhora } from "@/features/rescates/useAhora";
import { rescatesApi } from "@/services/api/rescates";
import { leerRolToken } from "@/services/api/sesion";
import type { RescateDetalle, RescateHistorial } from "@/types/rescates";
import styles from "./DetalleRescate.module.css";
import { useDetalleRescate } from "./useDetalleRescate";

/**
 * Detalle del rescate (#12 · CA-02.3, RF-010, RNF-005): consume GET /api/v1/rescates/{id} (#37).
 * El voluntario asignado ve los cuatro datos del traslado: lugar y hora límite de recogida,
 * cantidad aproximada y la organización destino con su dirección. Incluye el contenedor de
 * acciones por rol y estado, donde #45 (recogida) y #44 (no completado) agregan las suyas.
 */
export function DetalleRescate() {
  const { id } = useParams<{ id: string }>();
  const { datos, error, recargar } = useDetalleRescate(id);
  const recargarYa = () => void recargar();

  let contenido: React.ReactNode;
  if (error) {
    contenido = <ErrorDetalle status={error.status} mensaje={error.mensaje} reintentar={recargarYa} />;
  } else if (!datos) {
    contenido = (
      <div aria-busy="true" aria-label="Cargando rescate">
        <span className="skeleton" style={{ width: 240, height: 28 }} />
        <span className="skeleton" style={{ width: "100%", height: 180, marginTop: 16 }} />
      </div>
    );
  } else {
    contenido = <Contenido rescate={datos.rescate} historial={datos.historial} recargar={recargarYa} />;
  }

  return <main className={styles.pagina}>{contenido}</main>;
}

/**
 * #12 pide que un voluntario no asignado reciba un mensaje claro. La API (#37) responde 404 tanto
 * si el rescate no existe como si no tiene permiso (para no revelar que existe), y 403 si el rol
 * no está permitido: los dos casos se explican igual.
 */
function ErrorDetalle({ status, mensaje, reintentar }: { status: number | null; mensaje: string; reintentar: () => void }) {
  if (status === 403 || status === 404) {
    return (
      <div className="notice notice--warning" role="alert">
        <div>
          <p>
            <strong>No puedes ver este rescate.</strong>
          </p>
          <p>
            Solo lo ven administración, la fundación, el voluntario asignado, la organización que lo recibe y el
            comercio que avisó. Si crees que es un error, comunícate con la fundación.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="notice notice--error" role="alert">
      <div>
        <p>No se pudo cargar el rescate. {mensaje}</p>
        <div className="notice__actions">
          <button type="button" className="btn btn--secondary btn--compact" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}

function Contenido({
  rescate,
  historial,
  recargar,
}: {
  rescate: RescateDetalle;
  historial: RescateHistorial[];
  recargar: () => void;
}) {
  const esFundacion = leerRolToken() === "fundacion";
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  async function cerrarNoCompletado() {
    setGuardando(true);
    setErrorAccion(null);
    try {
      await rescatesApi.noCompletado(rescate.id, motivo.trim());
      setConfirmando(false);
      setMotivo("");
      recargar();
    } catch (error) {
      setErrorAccion((error as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const ahora = useAhora();
  const activo = rescate.estado === "disponible" || rescate.estado === "asignado";
  const t = rescate.hora_limite ? restante(rescate.hora_limite, ahora) : null;

  return (
    <>
      <div className={`title-row ${styles.encabezado}`}>
        <div>
          <span className={styles.kicker}>Seguimiento de donación</span>
          <h1>{rescate.alimento ?? "Datos del traslado"}</h1>
          <p className={styles.sub}>
            <span className="num">Rescate {referencia(rescate.id)}</span>
            {rescate.comercio && ` · ${rescate.comercio}`}
          </p>
        </div>
        <StatusPill estado={rescate.estado_visual ?? rescate.estado} />
      </div>

      <section className="panel" aria-labelledby="traslado-titulo">
        <div className="panel__header">
          <h2 id="traslado-titulo" className={styles.seccion}>
            Datos del traslado
          </h2>
        </div>
        <dl className={styles.datos}>
          {rescate.lugar_recogida && (
            <div>
              <dt>Recoger en</dt>
              <dd>{rescate.lugar_recogida}</dd>
            </div>
          )}
          {rescate.hora_limite && t && (
            <div>
              <dt>Recoger antes de</dt>
              <dd>
                <span className="num">
                  {dia(rescate.hora_limite, ahora)}, {hora(rescate.hora_limite)}
                </span>
                {activo && <span className={`${styles.restante} ${t.urgente ? styles.urgente : ""}`}>{t.texto}</span>}
              </dd>
            </div>
          )}
          {rescate.cantidad_aprox && (
            <div>
              <dt>Cantidad aproximada</dt>
              <dd>{rescate.cantidad_aprox}</dd>
            </div>
          )}
          <div>
            <dt>Entregar en</dt>
            <dd>
              {rescate.organizacion ? (
                <>
                  {rescate.organizacion}
                  {rescate.lugar_entrega && <span className={styles.direccion}>{rescate.lugar_entrega}</span>}
                </>
              ) : (
                <span className={styles.pendiente}>Todavía sin organización asignada</span>
              )}
            </dd>
          </div>
          {rescate.voluntario && (
            <div>
              <dt>Voluntario</dt>
              <dd>{rescate.voluntario}</dd>
            </div>
          )}
          {rescate.origen_aviso && (
            <div>
              <dt>Aviso creado por</dt>
              <dd>{rescate.origen_aviso === "fundacion" ? "Fundación" : "Comercio"}</dd>
            </div>
          )}
          {rescate.observaciones && (
            <div>
              <dt>Observaciones</dt>
              <dd>{rescate.observaciones}</dd>
            </div>
          )}
        </dl>
      </section>

      {historial.length > 0 && <LineaTiempo historial={historial} />}

      {rescate.motivo_no_completado && (
        <section className="panel" aria-labelledby="motivo-cierre-titulo">
          <div className="panel__header">
            <h2 id="motivo-cierre-titulo" className={styles.seccion}>Motivo de cierre</h2>
          </div>
          <p className={styles.motivo}>{rescate.motivo_no_completado}</p>
        </section>
      )}

      {esFundacion && activo && (
        <section className={`panel ${styles.cierre}`} aria-labelledby="cierre-titulo">
          <div className="panel__header">
            <h2 id="cierre-titulo" className={styles.seccion}>Cerrar rescate</h2>
          </div>
          <div className={styles.cierreContenido}>
            <label className={styles.etiqueta} htmlFor="motivo-no-completado">Motivo por el que no se pudo completar</label>
            <textarea
              id="motivo-no-completado"
              className="textarea"
              maxLength={2000}
              required
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              aria-describedby="ayuda-motivo-no-completado"
            />
            <p id="ayuda-motivo-no-completado" className="meta">El motivo quedará guardado en el historial del rescate.</p>
            {errorAccion && <p className={styles.errorAccion} role="alert">{errorAccion}</p>}
            {confirmando ? (
              <div className={styles.confirmacion} role="alertdialog" aria-labelledby="confirmar-cierre-titulo">
                <p id="confirmar-cierre-titulo"><strong>¿Cerrar este rescate como no completado?</strong></p>
                <p>Se guardará el motivo y el estado cambiará de forma permanente.</p>
                <div className={styles.botonesCierre}>
                  <button type="button" className="btn btn--danger" disabled={guardando} onClick={() => void cerrarNoCompletado()}>
                    {guardando ? "Guardando…" : "Confirmar cierre"}
                  </button>
                  <button type="button" className="btn btn--secondary" disabled={guardando} onClick={() => setConfirmando(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--danger"
                disabled={!motivo.trim() || guardando}
                onClick={() => setConfirmando(true)}
              >
                Marcar como no completado
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function LineaTiempo({ historial }: { historial: RescateHistorial[] }) {
  return (
    <section className={`panel ${styles.historial}`} aria-labelledby="historial-titulo">
      <div className="panel__header">
        <h2 id="historial-titulo" className={styles.seccion}>
          Historial del rescate
        </h2>
      </div>
      <ol className={styles.timeline}>
        {historial.map((transicion) => (
          <li key={transicion.id} className={styles.evento}>
            <span className={styles.marcador} aria-hidden="true" />
            <div className={styles.eventoContenido}>
              <p className={styles.transicion}>
                {transicion.estado_anterior
                  ? `${transicion.estado_anterior} → ${transicion.estado_nuevo}`
                  : `Creado como ${transicion.estado_nuevo}`}
              </p>
              <p className={styles.fecha}>
                {fechaCompleta(new Date(transicion.ocurrido_en))} · {hora24(new Date(transicion.ocurrido_en))}
              </p>
              <p className={styles.actor}>
                Responsable: <strong>{transicion.actor_nombre}</strong> · {transicion.actor_rol}
              </p>
              <DetalleTransicion detalle={transicion.detalle} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DetalleTransicion({ detalle }: { detalle: Record<string, unknown> }) {
  const entradas = Object.entries(detalle).filter(
    ([, valor]) => typeof valor === "string" || typeof valor === "number",
  );
  if (entradas.length === 0) return null;
  return (
    <dl className={styles.detalle}>
      {entradas.map(([clave, valor]) => (
        <div key={clave}>
          <dt>{etiquetaDetalle(clave)}</dt>
          <dd>{String(valor)}</dd>
        </div>
      ))}
    </dl>
  );
}

function etiquetaDetalle(clave: string): string {
  return clave.replaceAll("_", " ").replace(/^\w/, (letra) => letra.toUpperCase());
}
