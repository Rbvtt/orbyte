"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconoBuscar, IconoCalendario, IconoChevron, IconoInfo } from "@/components/ui/Iconos";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  agrupar,
  contar,
  detalleHora,
  detalleVoluntario,
  estadoVisible,
  ESTADOS_ACTIVOS,
  filtrar,
  GRUPO,
  resumenPendientes,
  type Grupo,
  type EstadoVisible,
} from "./agrupar";
import styles from "./RescatesActivos.module.css";
import { dia, fechaCompleta, hora24 } from "./tiempo";
import { referencia } from "./referencia";
import { useAhora } from "./useAhora";
import { useRescatesActivos, type FilaRescate } from "./useRescatesActivos";

/**
 * Rescates activos (#38 · CA-03.1, CA-03.2), según el diseño de #14: cada rescate activo con su
 * estado en texto, agrupados por estado y con los pendientes de asignar resaltados.
 */
export function RescatesActivos() {
  const { rescates, error, actualizadoEn, actualizar } = useRescatesActivos();
  const ahora = useAhora();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoVisible | "todos">("todos");

  const todos = useMemo(() => rescates ?? [], [rescates]);
  const conteo = useMemo(() => contar(todos, ahora), [todos, ahora]);
  const visibles = useMemo(() => filtrar(todos, busqueda, estado, ahora), [todos, busqueda, estado, ahora]);
  const grupos = useMemo(() => agrupar(visibles, ahora), [visibles, ahora]);

  return (
    <div className="page">
      <div className={styles.cabecera}>
        <div>
          <h1>Rescates activos</h1>
          <p className={styles.subtitulo}>Supervisa la operación de la jornada de hoy.</p>
        </div>
        <div className={styles.accionesCabecera}>
          <div className={styles.fecha}>
            <p className={styles.hoy}>
              <IconoCalendario tamano={18} />
              {fechaCompleta(ahora)}
            </p>
            {actualizadoEn && <p className="meta">Última actualización: {hora24(actualizadoEn)} h</p>}
          </div>
          <Link href="/aviso/nuevo" className="btn btn--primary">
            Registrar aviso
          </Link>
        </div>
      </div>

      <ul className={styles.resumen} aria-label="Rescates por estado">
        {ESTADOS_ACTIVOS.map((e) => (
          <li key={e} className={styles[`resumen_${e}`]}>
            <span className={styles.resumenTitulo}>{GRUPO[e]?.titulo}</span>
            <span className={`num ${styles.resumenCuenta}`}>{rescates ? conteo[e] : "–"}</span>
            <span className={styles.resumenTexto}>{e === "disponible" ? resumenPendientes(todos, ahora) : GRUPO[e]?.resumen}</span>
          </li>
        ))}
      </ul>

      <div className={styles.herramientas}>
        <label className={styles.buscar}>
          <IconoBuscar tamano={18} />
          <span className="sr-only">Buscar</span>
          <input
            className="input"
            type="search"
            placeholder="Buscar alimento, comercio o voluntario"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Estado</span>
          <select className="select" value={estado} onChange={(e) => setEstado(e.target.value as EstadoVisible | "todos")}>
            <option value="todos">Todos los estados</option>
            {ESTADOS_ACTIVOS.map((e) => (
              <option key={e} value={e}>
                {GRUPO[e]?.titulo}
              </option>
            ))}
          </select>
        </label>
        <p className={`meta ${styles.orden}`}>Agrupado por estado · hora límite ascendente</p>
      </div>

      <section className="panel" aria-labelledby="tabla-titulo">
        <div className={`panel__header ${styles.panelCabecera}`}>
          <h2 id="tabla-titulo" className={styles.panelTitulo}>
            Rescates activos <span className="meta">{todos.length} rescates</span>
          </h2>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            <p>
              No se pudieron cargar los rescates. {error}
              {actualizadoEn && ` Se muestran los datos de las ${hora24(actualizadoEn)} h.`}
            </p>
            <button type="button" className="btn btn--ghost btn--compact" onClick={actualizar}>
              Reintentar
            </button>
          </div>
        )}

        {rescates === null && !error ? (
          <TablaCargando />
        ) : rescates && grupos.length === 0 ? (
          <p className={styles.vacio}>
            {todos.length === 0 ? "No hay rescates activos. Cuando un comercio avise, aparecerá aquí." : "Ningún rescate coincide con la búsqueda."}
          </p>
        ) : (
          <Tabla grupos={grupos} ahora={ahora} />
        )}

        {rescates && (
          <div className={styles.pieTabla}>
            <p>¹ Hora límite de recogida en el comercio.</p>
            <p className="num">
              {visibles.length} de {todos.length} rescates
            </p>
          </div>
        )}
      </section>

      <p className={styles.nota}>
        <IconoInfo tamano={16} />
        Los avisos vencidos aparecen como «No disponible» y ya no se pueden asignar.
      </p>
    </div>
  );
}

function Tabla({ grupos, ahora }: { grupos: Grupo[]; ahora: Date }) {
  const [cerrados, setCerrados] = useState<Set<EstadoVisible>>(new Set());
  const alternar = (e: EstadoVisible) =>
    setCerrados((c) => {
      const nuevo = new Set(c);
      if (nuevo.has(e)) nuevo.delete(e);
      else nuevo.add(e);
      return nuevo;
    });

  return (
    <div className={styles.marcoTabla}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            <th scope="col">Alimento y cantidad</th>
            <th scope="col">Comercio</th>
            <th scope="col">Destino</th>
            <th scope="col">Voluntario</th>
            <th scope="col">Hora límite¹</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        {grupos.map((g) => {
          const abierto = !cerrados.has(g.estado);
          return (
            <tbody key={g.estado}>
              <tr className={styles.grupo}>
                <th scope="colgroup" colSpan={7}>
                  <button type="button" className={styles.grupoBoton} aria-expanded={abierto} onClick={() => alternar(g.estado)}>
                    <IconoChevron tamano={16} className={abierto ? undefined : styles.girado} />
                    <strong>
                      {GRUPO[g.estado]?.titulo} · {g.rescates.length}
                    </strong>
                    <span>{GRUPO[g.estado]?.descripcion}</span>
                  </button>
                </th>
              </tr>
              {abierto && g.rescates.map((r) => <Fila key={r.id} r={r} ahora={ahora} />)}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function Fila({ r, ahora }: { r: FilaRescate; ahora: Date }) {
  const limite = detalleHora(r, ahora);
  const estado = estadoVisible(r, ahora);
  const puedeAsignar = estado === "disponible" && r.pendiente_asignar;
  return (
    <tr className={puedeAsignar ? styles.pendiente : undefined}>
      <td className={styles.alimento}>
        <span className={styles.principal}>{r.alimento ?? "Rescate"}</span>
        <span className={styles.sub}>
          {r.cantidad_aprox ? `${r.cantidad_aprox} · ` : ""}
          <span className="num">{referencia(r.id)}</span>
        </span>
      </td>
      <td className={styles.comercio}>{r.comercio}</td>
      <td className={styles.destino}>
        {r.organizacion ?? (
          <span className={styles.falta}>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Sin destino</span>
          </span>
        )}
      </td>
      <td className={styles.voluntario}>
        {r.voluntario ? (
          <span className={styles.principalSuave}>{r.voluntario}</span>
        ) : (
          <span className={styles.sinAsignar}>Sin asignar</span>
        )}
        <span className={styles.sub}>{detalleVoluntario(r, ahora)}</span>
      </td>
      <td className={styles.hora}>
        <span className={`num ${limite.urgente ? styles.urgente : styles.principalSuave}`}>
          {hora24(new Date(r.hora_limite))} h{dia(r.hora_limite, ahora) !== "hoy" && ` · ${dia(r.hora_limite, ahora)}`}
        </span>
        <span className={`${styles.sub} ${limite.urgente ? styles.urgente : ""}`}>{limite.texto}</span>
      </td>
      <td className={styles.estado}>
        <StatusPill estado={estado} />
      </td>
      <td className={styles.acciones}>
        {puedeAsignar ? (
          <Link href={`/fundacion/rescates/${r.id}/asignar`} className="btn btn--primary btn--compact">
            Asignar
          </Link>
        ) : estado !== "no_disponible" ? (
          <button type="button" className="btn btn--secondary btn--compact" disabled>
            Asignar
          </button>
        ) : null}
        <Link href={`/rescates/${r.id}`} className="btn btn--secondary btn--compact">
          Ver detalle
        </Link>
      </td>
    </tr>
  );
}

function TablaCargando() {
  return (
    <div className={styles.cargando} aria-busy="true" aria-label="Cargando rescates">
      {[0, 1, 2].map((i) => (
        <span key={i} className="skeleton" style={{ width: "100%", height: 44 }} />
      ))}
    </div>
  );
}
