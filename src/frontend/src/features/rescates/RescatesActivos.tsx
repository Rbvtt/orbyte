"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import type { EstadoRescate, RescateResumen } from "@/types/api";
import styles from "./RescatesActivos.module.css";
import { dia, hallazgo, hora, restante } from "./tiempo";
import { useAhora, useRescatesActivos } from "./useRescatesActivos";

type Filtro = "todos" | Extract<EstadoRescate, "disponible" | "asignado" | "recogido">;

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: "todos", texto: "Todos" },
  { id: "disponible", texto: "Pendientes de asignar" },
  { id: "asignado", texto: "Asignados" },
  { id: "recogido", texto: "Recogidos" },
];

/**
 * Rescates activos (#14, #38 · CA-03.1, CA-03.2).
 * La pregunta de la pantalla: ¿qué rescates necesitan voluntario antes de que venzan?
 */
export function RescatesActivos() {
  const { rescates, error, actualizadoEn, cargando, actualizar } = useRescatesActivos();
  const ahora = useAhora();
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const conteo = useMemo(() => {
    const c: Record<Filtro, number> = { todos: 0, disponible: 0, asignado: 0, recogido: 0 };
    for (const r of rescates ?? []) {
      c.todos += 1;
      if (r.estado in c) c[r.estado as Filtro] += 1;
    }
    return c;
  }, [rescates]);

  const visibles = useMemo(
    () => (rescates ?? []).filter((r) => filtro === "todos" || r.estado === filtro),
    [rescates, filtro],
  );

  const h = rescates ? hallazgo(rescates, ahora) : null;

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1>Rescates activos</h1>
          <p className="finding" aria-live="polite">
            {rescates === null && !error && <span className="skeleton" style={{ width: 280 }} />}
            {h && h.pendientes === 0 && "Todos los rescates activos tienen voluntario."}
            {h && h.pendientes > 0 && h.masUrgente && h.restanteMasUrgente && (
              <>
                <strong>
                  {h.pendientes} {h.pendientes === 1 ? "pendiente" : "pendientes"} de asignar
                </strong>
                {" · el que vence primero es "}
                {h.masUrgente.alimento.toLowerCase()} de {h.masUrgente.comercio_nombre}
                {", "}
                <span className={h.restanteMasUrgente.urgente ? "urgente" : undefined}>
                  {h.restanteMasUrgente.vencido ? h.restanteMasUrgente.texto : `${h.restanteMasUrgente.texto} (${hora(h.masUrgente.hora_limite)})`}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <section className="panel" aria-labelledby="tabla-titulo">
        <div className={`panel__header ${styles.cabecera}`}>
          <h2 id="tabla-titulo" className="sr-only">
            Listado de rescates activos
          </h2>
          <div className={styles.filtros} role="tablist" aria-label="Filtrar por estado">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                className={styles.filtro}
                onClick={() => setFiltro(f.id)}
              >
                {f.texto} <span className={`num ${styles.cuenta}`}>{conteo[f.id]}</span>
              </button>
            ))}
          </div>
          <div className={styles.frescura}>
            {actualizadoEn && <span className="meta">Actualizado {hora(actualizadoEn.toISOString())}</span>}
            <button type="button" className="btn btn--secondary btn--compact" onClick={actualizar} disabled={cargando}>
              {cargando && rescates ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            <p>
              No se pudieron cargar los rescates. {error}
              {actualizadoEn && ` Se muestran los datos de las ${hora(actualizadoEn.toISOString())}.`}
            </p>
            <button type="button" className="btn btn--ghost btn--compact" onClick={actualizar}>
              Reintentar
            </button>
          </div>
        )}

        {rescates === null && !error ? (
          <TablaCargando />
        ) : rescates && visibles.length === 0 ? (
          <div className={styles.vacio}>
            {rescates.length === 0 ? (
              <p>No hay rescates activos. Cuando un comercio avise, aparecerá aquí.</p>
            ) : (
              <p>No hay rescates en este estado.</p>
            )}
          </div>
        ) : (
          <Tabla rescates={visibles} ahora={ahora} />
        )}
      </section>
    </div>
  );
}

function Tabla({ rescates, ahora }: { rescates: RescateResumen[]; ahora: Date }) {
  return (
    <div className={styles.marcoTabla}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            <th scope="col">Alimento</th>
            <th scope="col">Comercio</th>
            <th scope="col">Destino</th>
            <th scope="col">Voluntario</th>
            <th scope="col" className={styles.derecha}>
              Hora límite
            </th>
            <th scope="col">Estado</th>
            <th scope="col">
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rescates.map((r) => {
            const t = restante(r.hora_limite, ahora);
            const urgentePendiente = r.pendiente_asignar && t.urgente;
            return (
              <tr key={r.id} className={r.pendiente_asignar ? styles.pendiente : undefined}>
                <td className={styles.identidad}>
                  <span className={styles.alimento}>{r.alimento}</span>
                  <span className={styles.sub}>
                    <span className="num">n.º {r.numero}</span> · {r.cantidad_aprox}
                  </span>
                </td>
                <td className={styles.comercio}>{r.comercio_nombre}</td>
                <td className={`${styles.destino} ${r.organizacion_nombre ? "" : styles.celdaVacia}`}>
                  {r.organizacion_nombre ?? <Falta texto="Sin destino" />}
                </td>
                <td className={`${styles.voluntario} ${r.voluntario_nombre ? "" : styles.celdaVacia}`}>
                  {r.voluntario_nombre ?? <Falta texto="Sin voluntario" />}
                </td>
                <td className={`${styles.derecha} ${styles.hora}`}>
                  <span className="num">
                    {hora(r.hora_limite)}
                    {dia(r.hora_limite, ahora) !== "hoy" && <span className={styles.diaTexto}> · {dia(r.hora_limite, ahora)}</span>}
                  </span>
                  <span className={`num ${styles.sub} ${urgentePendiente ? styles.urgente : ""}`}>{t.texto}</span>
                </td>
                <td className={styles.estado}>
                  <StatusPill estado={r.estado} />
                </td>
                <td className={styles.accion}>
                  <span className={styles.acciones}>
                    {r.pendiente_asignar && (
                      <Link href={`/fundacion/rescates/${r.id}/asignar`} className="btn btn--secondary btn--compact">
                        Asignar
                      </Link>
                    )}
                    <Link href={`/rescates/${r.id}`} className="btn btn--ghost btn--compact">
                      Detalle
                    </Link>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Un dato que falta se ve como una raya gris; el lector de pantalla oye qué falta. */
function Falta({ texto }: { texto: string }) {
  return (
    <>
      <span aria-hidden="true" className={styles.vacioCelda}>
        —
      </span>
      <span className="sr-only">{texto}</span>
    </>
  );
}

function TablaCargando() {
  return (
    <div className={styles.marcoTabla} aria-busy="true" aria-label="Cargando rescates">
      <table className={styles.tabla}>
        <tbody>
          {[0, 1, 2].map((i) => (
            <tr key={i}>
              <td className={styles.identidad}>
                <span className="skeleton" style={{ width: 180 }} />
                <span className="skeleton" style={{ width: 120, height: 12, marginTop: 6 }} />
              </td>
              <td className={styles.comercio}>
                <span className="skeleton" style={{ width: 120 }} />
              </td>
              <td className={styles.destino}>
                <span className="skeleton" style={{ width: 110 }} />
              </td>
              <td className={styles.voluntario}>
                <span className="skeleton" style={{ width: 100 }} />
              </td>
              <td className={styles.derecha}>
                <span className="skeleton" style={{ width: 70 }} />
              </td>
              <td className={styles.estado}>
                <span className="skeleton" style={{ width: 90, height: 24, borderRadius: 999 }} />
              </td>
              <td className={styles.accion} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
