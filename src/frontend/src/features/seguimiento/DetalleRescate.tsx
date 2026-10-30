"use client";

import { useParams } from "next/navigation";
import { StatusPill } from "@/components/ui/StatusPill";
import { referencia } from "@/features/rescates/referencia";
import { dia, hora, restante } from "@/features/rescates/tiempo";
import { useAhora } from "@/features/rescates/useAhora";
import type { RescateDetalle } from "@/types/rescates";
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
    contenido = <Contenido rescate={datos.rescate} />;
  }

  return <div className="page page--narrow">{contenido}</div>;
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
            Solo lo ven la fundación, el voluntario asignado, la organización que lo recibe y el comercio que avisó. Si
            crees que es un error, comunícate con la fundación.
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

function Contenido({ rescate }: { rescate: RescateDetalle }) {
  const ahora = useAhora();
  const activo = rescate.estado === "disponible" || rescate.estado === "asignado";
  const t = rescate.hora_limite ? restante(rescate.hora_limite, ahora) : null;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{rescate.alimento ?? "Datos del traslado"}</h1>
          <p className={styles.sub}>
            <span className="num">Rescate {referencia(rescate.id)}</span>
            {rescate.comercio && ` · ${rescate.comercio}`}
          </p>
        </div>
        <StatusPill estado={rescate.estado} />
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
          {rescate.observaciones && (
            <div>
              <dt>Observaciones</dt>
              <dd>{rescate.observaciones}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Contenedor de acciones por rol y estado: aquí van la recogida (#45) y el cierre como no completado (#44). */}
    </>
  );
}
