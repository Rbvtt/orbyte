"use client";

import { useParams } from "next/navigation";
import { StatusPill } from "@/components/ui/StatusPill";
import { dia, hora, restante } from "@/features/rescates/tiempo";
import { useAhora } from "@/features/rescates/useRescatesActivos";
import { SimulacionLocal } from "@/features/simulacion/SimulacionLocal";
import type { RescateSeguimiento, UsuarioActual } from "@/types/api";
import { AccionNoCompletado } from "./AccionNoCompletado";
import { AccionRecogida } from "./AccionRecogida";
import styles from "./DetalleRescate.module.css";
import { puedeMarcarNoCompletado, puedeRegistrarRecogida } from "./reglas";
import { useDetalleRescate } from "./useDetalleRescate";

/**
 * Detalle del rescate (#12 · CA-02.3, RF-010): los cuatro datos del traslado para el
 * voluntario asignado, y el contenedor de acciones por rol y estado (#45 recogida, #44 no completado).
 */
export function DetalleRescate() {
  const { id } = useParams<{ id: string }>();
  const { datos, error, recargar, reemplazar } = useDetalleRescate(id);
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
    contenido = <Contenido rescate={datos.rescate} usuario={datos.usuario} alCambiar={reemplazar} alConflicto={recargarYa} />;
  }

  return (
    <div className="page page--narrow">
      <SimulacionLocal alCambiar={recargarYa} conRescates />
      {contenido}
    </div>
  );
}

function ErrorDetalle({ status, mensaje, reintentar }: { status: number | null; mensaje: string; reintentar: () => void }) {
  // Voluntario no asignado (u otro rol sin acceso): 403 con un mensaje claro (#12).
  if (status === 403) {
    return (
      <div className="notice notice--warning" role="alert">
        <div>
          <p>
            <strong>No puedes ver este rescate.</strong>
          </p>
          <p>Solo lo ven la fundación, el voluntario asignado y la organización que lo recibe. Si crees que es un error, comunícate con la fundación.</p>
        </div>
      </div>
    );
  }
  if (status === 404) {
    return (
      <div className="notice notice--error" role="alert">
        <p>Este rescate no existe o el enlace está incompleto.</p>
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
  usuario,
  alCambiar,
  alConflicto,
}: {
  rescate: RescateSeguimiento;
  usuario: UsuarioActual;
  alCambiar: (r: RescateSeguimiento) => void;
  alConflicto: () => void;
}) {
  const ahora = useAhora();
  const t = restante(rescate.hora_limite, ahora);
  const activo = rescate.estado === "disponible" || rescate.estado === "asignado";
  const recogida = puedeRegistrarRecogida(usuario, rescate);
  const noCompletado = puedeMarcarNoCompletado(usuario, rescate);

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{rescate.alimento}</h1>
          <p className={styles.sub}>
            <span className="num">Rescate n.º {rescate.numero}</span> · {rescate.comercio_nombre}
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
          <div>
            <dt>Recoger en</dt>
            <dd>{rescate.lugar_recogida}</dd>
          </div>
          <div>
            <dt>Recoger antes de</dt>
            <dd>
              <span className="num">
                {dia(rescate.hora_limite, ahora)}, {hora(rescate.hora_limite)}
              </span>
              {activo && <span className={`${styles.restante} ${t.urgente ? styles.urgente : ""}`}>{t.texto}</span>}
            </dd>
          </div>
          <div>
            <dt>Cantidad aproximada</dt>
            <dd>{rescate.cantidad_aprox}</dd>
          </div>
          <div>
            <dt>Entregar en</dt>
            <dd>
              {rescate.organizacion_nombre ? (
                <>
                  {rescate.organizacion_nombre}
                  <span className={styles.direccion}>{rescate.organizacion_direccion}</span>
                </>
              ) : (
                <span className={styles.pendiente}>Todavía sin organización asignada</span>
              )}
            </dd>
          </div>
          {rescate.voluntario_nombre && (
            <div>
              <dt>Voluntario</dt>
              <dd>{rescate.voluntario_nombre}</dd>
            </div>
          )}
          {rescate.observaciones && (
            <div>
              <dt>Observaciones</dt>
              <dd>{rescate.observaciones}</dd>
            </div>
          )}
          {rescate.recogido_en && (
            <div>
              <dt>Recogido</dt>
              <dd className="num">
                {dia(rescate.recogido_en, ahora)}, {hora(rescate.recogido_en)}
              </dd>
            </div>
          )}
          {rescate.estado === "no_completado" && rescate.motivo_no_completado && (
            <div>
              <dt>Motivo de no completado</dt>
              <dd>{rescate.motivo_no_completado}</dd>
            </div>
          )}
          {rescate.personas_beneficiadas !== null && (
            <div>
              <dt>Personas beneficiadas</dt>
              <dd className="num">{rescate.personas_beneficiadas}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Contenedor de acciones por rol y estado: recogida (#45) y no completado (#44). */}
      {(recogida || noCompletado) && (
        <section className={styles.acciones} aria-label="Acciones">
          {recogida && <AccionRecogida key={`r-${rescate.estado}`} rescate={rescate} alCambiar={alCambiar} alConflicto={alConflicto} />}
          {noCompletado && <AccionNoCompletado key={`n-${rescate.estado}`} rescate={rescate} alCambiar={alCambiar} alConflicto={alConflicto} />}
        </section>
      )}
    </>
  );
}
