"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import type { Organizacion, Voluntario } from "@/types/asignacion";
import type { RescateDetalle } from "@/types/rescates";
import styles from "./AsignarRescate.module.css";
import { referencia } from "./referencia";
import { dia, hora, restante } from "./tiempo";
import { useAsignacion } from "./useAsignacion";
import { useAhora } from "./useAhora";

const NECESITA_FRIO = /nevera|refriger|fr[ií]o|congel/i;

function kg(capacidad: number | null): string {
  if (capacidad === null) return "—";
  return `${Number.isInteger(capacidad) ? capacidad : capacidad.toFixed(1)} kg`;
}

/**
 * Asignación (#39 · CA-02.1, CA-02.2): la fundación elige a dónde va el alimento y quién lo lleva,
 * comparando capacidad, refrigeración y horario de cada organización (RF-003).
 */
export function AsignarRescate() {
  const { id } = useParams<{ id: string }>();
  const { datos, errorCarga, resultado, asignar, recargar } = useAsignacion(id);
  const ahora = useAhora();
  const [organizacionId, setOrganizacionId] = useState("");
  const [voluntarioId, setVoluntarioId] = useState("");
  const [faltan, setFaltan] = useState<{ org?: boolean; vol?: boolean }>({});

  if (errorCarga && !datos) {
    return (
      <div className="page page--narrow">
        <div className="notice notice--error" role="alert">
          <div>
            <p>No se pudo cargar el rescate. {errorCarga}</p>
            <div className="notice__actions">
              <button type="button" className="btn btn--secondary btn--compact" onClick={() => void recargar()}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="page" aria-busy="true">
        <span className="skeleton" style={{ width: 260, height: 28 }} />
      </div>
    );
  }

  const { rescate, organizaciones, voluntarios } = datos;
  const disponible = rescate.estado === "disponible";
  // La fundación siempre recibe la hora límite en el detalle (#37).
  const limite = rescate.hora_limite ?? "";
  const t = restante(limite, ahora);
  const pideFrio = NECESITA_FRIO.test(`${rescate.alimento} ${rescate.observaciones ?? ""}`);
  const enviando = resultado.tipo === "enviando";

  function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    const nuevos = { org: !organizacionId, vol: !voluntarioId };
    setFaltan(nuevos);
    if (nuevos.org || nuevos.vol) return;
    void asignar(organizacionId, voluntarioId);
  }

  return (
    <div className="page">
      <nav className={styles.migas} aria-label="Ruta">
        <Link href="/fundacion/rescates">← Rescates activos</Link>
      </nav>

      <div className="title-row">
        <div>
          <h1>
            Asignar rescate <span className="num">{referencia(rescate.id)}</span>
          </h1>
          <p className="finding">
            {rescate.alimento} de {rescate.comercio} ·{" "}
            <span className={t.urgente && disponible ? "urgente" : undefined}>
              recoger antes de las {hora(limite)}
              {dia(limite, ahora) !== "hoy" ? ` (${dia(limite, ahora)})` : ""} · {t.texto}
            </span>
          </p>
        </div>
      </div>

      {resultado.tipo === "conflicto" && (
        <div className={`notice notice--warning ${styles.aviso}`} role="alert">
          <p>{resultado.mensaje}</p>
        </div>
      )}
      {resultado.tipo === "error" && (
        <div className={`notice notice--error ${styles.aviso}`} role="alert">
          <p>{resultado.mensaje}</p>
        </div>
      )}

      <div className={styles.columnas}>
        <ResumenRescate rescate={rescate} />

        {disponible ? (
          <form className={styles.formulario} onSubmit={alEnviar} noValidate>
            <fieldset className={`panel ${styles.grupo}`} aria-describedby={faltan.org ? "falta-org" : undefined}>
              <legend className={styles.leyenda}>¿A qué organización va?</legend>
              {pideFrio && (
                <p className={styles.pista}>Las observaciones mencionan frío o nevera: compara la columna de refrigeración.</p>
              )}
              {faltan.org && (
                <p id="falta-org" className="field__error" role="alert">
                  Elige una organización receptora.
                </p>
              )}
              <ListaOrganizaciones
                organizaciones={organizaciones}
                elegida={organizacionId}
                elegir={(v) => {
                  setOrganizacionId(v);
                  setFaltan((f) => ({ ...f, org: false }));
                }}
              />
            </fieldset>

            <fieldset className={`panel ${styles.grupo}`} aria-describedby={faltan.vol ? "falta-vol" : undefined}>
              <legend className={styles.leyenda}>¿Qué voluntario lo lleva?</legend>
              {faltan.vol && (
                <p id="falta-vol" className="field__error" role="alert">
                  Elige un voluntario.
                </p>
              )}
              <ListaVoluntarios
                voluntarios={voluntarios}
                elegido={voluntarioId}
                elegir={(v) => {
                  setVoluntarioId(v);
                  setFaltan((f) => ({ ...f, vol: false }));
                }}
              />
            </fieldset>

            <div className={styles.barraEnvio}>
              <button type="submit" className="btn btn--primary" disabled={enviando} aria-busy={enviando}>
                {enviando ? "Asignando…" : "Asignar rescate"}
              </button>
              <Link href="/fundacion/rescates" className="btn btn--ghost">
                Cancelar
              </Link>
            </div>
          </form>
        ) : (
          <EstadoActual rescate={rescate} recienAsignado={resultado.tipo === "exito"} />
        )}
      </div>
    </div>
  );
}

function ResumenRescate({ rescate }: { rescate: RescateDetalle }) {
  return (
    <section className={`panel ${styles.resumen}`} aria-labelledby="resumen-titulo">
      <div className="panel__header">
        <h2 id="resumen-titulo">El rescate</h2>
        <StatusPill estado={rescate.estado} />
      </div>
      <dl className={styles.datos}>
        <div>
          <dt>Alimento</dt>
          <dd>{rescate.alimento}</dd>
        </div>
        <div>
          <dt>Cantidad</dt>
          <dd>{rescate.cantidad_aprox}</dd>
        </div>
        <div>
          <dt>Comercio</dt>
          <dd>{rescate.comercio}</dd>
        </div>
        <div>
          <dt>Se recoge en</dt>
          <dd>{rescate.lugar_recogida}</dd>
        </div>
        {rescate.observaciones && (
          <div>
            <dt>Observaciones</dt>
            <dd>{rescate.observaciones}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function ListaOrganizaciones({
  organizaciones,
  elegida,
  elegir,
}: {
  organizaciones: Organizacion[];
  elegida: string;
  elegir: (id: string) => void;
}) {
  if (organizaciones.length === 0) {
    return <p className={styles.vacio}>No hay organizaciones receptoras registradas. Hay que cargarlas primero (#36).</p>;
  }
  return (
    <div className={styles.opciones}>
      <div className={styles.encabezadoOrg} aria-hidden="true">
        <span>Organización</span>
        <span className={styles.derecha}>Capacidad</span>
        <span>Refrigeración</span>
        <span>Recibe</span>
      </div>
      {organizaciones.map((o) => (
        <label key={o.id} className={`${styles.opcion} ${styles.opcionOrg}`} data-elegida={elegida === o.id || undefined}>
          <input type="radio" name="organizacion" value={o.id} checked={elegida === o.id} onChange={() => elegir(o.id)} />
          <span className={styles.nombre}>{o.nombre}</span>
          <span className={`num ${styles.derecha}`} data-etiqueta="Capacidad">
            {kg(o.capacidad_kg)}
          </span>
          <span data-etiqueta="Refrigeración">{o.refrigeracion ? "Con nevera" : "Sin nevera"}</span>
          <span data-etiqueta="Recibe" className={styles.horario}>
            {o.horario_recepcion ?? "—"}
          </span>
        </label>
      ))}
    </div>
  );
}

function ListaVoluntarios({
  voluntarios,
  elegido,
  elegir,
}: {
  voluntarios: Voluntario[];
  elegido: string;
  elegir: (id: string) => void;
}) {
  if (voluntarios.length === 0) {
    return <p className={styles.vacio}>No hay voluntarios activos registrados (#36).</p>;
  }
  return (
    <div className={styles.opciones}>
      {voluntarios.map((v) => (
        <label key={v.id} className={`${styles.opcion} ${styles.opcionVol}`} data-elegida={elegido === v.id || undefined}>
          <input type="radio" name="voluntario" value={v.id} checked={elegido === v.id} onChange={() => elegir(v.id)} />
          <span className={styles.nombre}>{v.nombre}</span>
          <span className={styles.subOpcion}>
            {[v.medio_transporte, v.disponibilidad].filter(Boolean).join(" · ") || "Sin datos de transporte"}
          </span>
        </label>
      ))}
    </div>
  );
}

function EstadoActual({ rescate, recienAsignado }: { rescate: RescateDetalle; recienAsignado: boolean }) {
  return (
    <section className={`panel ${styles.resultado}`} aria-live="polite">
      <div className="panel__body">
        {recienAsignado ? (
          <div className="notice notice--success">
            <p>Listo. El rescate quedó asignado.</p>
          </div>
        ) : (
          <p className={styles.yaNo}>Este rescate ya no está pendiente de asignar.</p>
        )}
        <dl className={styles.datos}>
          <div>
            <dt>Voluntario</dt>
            <dd>{rescate.voluntario ?? "—"}</dd>
          </div>
          <div>
            <dt>Destino</dt>
            <dd>
              {rescate.organizacion ?? "—"}
              {rescate.lugar_entrega && <span className={styles.subOpcion}>{rescate.lugar_entrega}</span>}
            </dd>
          </div>
          {rescate.asignado_en && (
            <div>
              <dt>Asignado</dt>
              <dd className="num">
                {dia(rescate.asignado_en)}, {hora(rescate.asignado_en)}
              </dd>
            </div>
          )}
        </dl>
        <div className={styles.barraEnvio}>
          <Link href="/fundacion/rescates" className="btn btn--primary">
            Volver a rescates activos
          </Link>
        </div>
      </div>
    </section>
  );
}
