"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api/client";
import { useAhora } from "@/features/rescates/useAhora";
import { leerToken } from "@/services/api/sesion";
import { rescatesApi } from "@/services/api/rescates";
import { sesionApi } from "@/services/api/sesionApi";
import type { OrganizacionReceptora, Voluntario } from "@/types/api";
import type { RescateDetalle } from "@/types/rescates";
import styles from "./asignar.module.css";

type Datos = {
  detalle: RescateDetalle;
  organizaciones: OrganizacionReceptora[];
  voluntarios: Voluntario[];
};

/** Capacidad en kg para comparar organizaciones (RF-003). */
function capacidad(kg: number | null): string {
  if (kg === null) return "Sin dato";
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

/**
 * CMP-02 · #39. La fundación asigna el rescate eligiendo la organización receptora con su
 * capacidad, refrigeración y horario a la vista (RF-003) y un voluntario activo. Si otra persona
 * lo asignó primero (409, CA-02.2) se explica qué pasó y se recarga el estado del rescate.
 */
export default function AsignarRescatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rescate, setRescate] = useState<RescateDetalle | null>(null);
  const [organizaciones, setOrganizaciones] = useState<OrganizacionReceptora[]>([]);
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([]);
  const [organizacionId, setOrganizacionId] = useState("");
  const [voluntarioId, setVoluntarioId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [conflicto, setConflicto] = useState("");
  const ahora = useAhora();
  const activo = useRef(true);

  /** Trae el rescate y los catálogos. Devuelve null si quien entra no es la fundación. */
  const obtener = useCallback(async (): Promise<Datos | null> => {
    const usuario = await sesionApi.me();
    if (usuario.rol !== "fundacion") return null;
    const [detalle, listaOrganizaciones, listaVoluntarios] = await Promise.all([
      rescatesApi.detalle(id),
      sesionApi.organizaciones(),
      sesionApi.voluntarios(),
    ]);
    return { detalle, organizaciones: listaOrganizaciones, voluntarios: listaVoluntarios };
  }, [id]);

  const aplicar = useCallback(
    (datos: Datos | null) => {
      if (!activo.current) return;
      if (datos === null) {
        router.replace("/home");
        return;
      }
      setRescate(datos.detalle);
      setOrganizaciones(datos.organizaciones);
      setVoluntarios(datos.voluntarios);
      setOrganizacionId(datos.detalle.organizacion_id ?? "");
      setVoluntarioId(datos.detalle.voluntario_id ?? "");
      setMotivo("");
    },
    [router],
  );

  const fallo = useCallback(
    (reason: unknown) => {
      if (!activo.current) return;
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "No se pudo cargar la asignación.");
    },
    [router],
  );

  useEffect(() => {
    activo.current = true;
    if (!leerToken()) {
      router.replace("/login");
    } else {
      obtener()
        .then(aplicar, fallo)
        .finally(() => {
          if (activo.current) setCargando(false);
        });
    }
    return () => {
      activo.current = false;
    };
  }, [obtener, aplicar, fallo, router]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setConflicto("");
    setEnviando(true);
    try {
      const datos = {
        organizacion_id: organizacionId,
        voluntario_id: voluntarioId,
      };
      if (rescate?.estado === "asignado") {
        await rescatesApi.reasignar(id, { ...datos, motivo: motivo.trim() });
      } else {
        await rescatesApi.asignar(id, datos);
      }
      router.push(`/rescates/${id}`);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        // CA-02.2: no se guardó nada; se explica y se muestra el estado real del rescate.
        setConflicto(reason.message);
        await obtener().then(aplicar, fallo);
      } else {
        setError(reason instanceof ApiError ? reason.message : "No se pudo guardar la asignación.");
      }
    } finally {
      setEnviando(false);
    }
  }

  const reasignando = rescate?.estado === "asignado";
  const vencido = rescate?.hora_limite ? Date.parse(rescate.hora_limite) <= ahora.getTime() : false;
  const estadoValido = rescate?.estado === "disponible" || reasignando;

  if (cargando) {
    return <main className={styles.pagina}><p className={styles.estado}>Cargando rescate…</p></main>;
  }

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <Link href="/fundacion/rescates" className={styles.volver}>← Volver a rescates</Link>
        <section className={styles.tarjeta}>
          <span className={styles.kicker}>Coordinación de rescates</span>
          <h1>{reasignando ? "Reasignar rescate" : "Asignar rescate"}</h1>
          <p className={styles.descripcion}>
            {reasignando
              ? "Selecciona la organización y el nuevo voluntario. El motivo quedará guardado en el historial."
              : "Compara las organizaciones receptoras y asigna un voluntario activo para coordinar la donación."}
          </p>

          {conflicto && (
            <div className={styles.error} role="alert">
              <strong>No se guardó tu asignación.</strong> {conflicto.replace(/\.$/, "")}. El rescate
              cambió mientras lo asignabas; actualizamos la pantalla con su estado actual.
            </div>
          )}
          {error && <div className={styles.error} role="alert">{error}</div>}

          {!rescate && !error ? (
            <p className={styles.estado}>No se encontró el rescate.</p>
          ) : !estadoValido || vencido ? (
            <div className={styles.aviso} role="status">
              Este rescate ya no está disponible para asignación o reasignación.
              <Link href={`/rescates/${id}`}>Consultar detalle</Link>
            </div>
          ) : (
            <>
              <div className={styles.resumen}>
                <strong>{rescate.alimento || "Donación"}</strong>
                <span>{rescate.cantidad_aprox}</span>
                <span>Recoger en: {rescate.lugar_recogida}</span>
                {reasignando && (
                  <span className={styles.actual}>
                    Asignado ahora a {rescate.voluntario ?? "un voluntario"}
                    {rescate.organizacion ? ` · entrega en ${rescate.organizacion}` : ""}
                  </span>
                )}
              </div>

              <form className={styles.formulario} onSubmit={guardar}>
                <fieldset className={styles.organizaciones}>
                  <legend>Organización receptora</legend>
                  <p className={styles.ayuda}>Compara capacidad, refrigeración y horario antes de elegir.</p>
                  <div className={styles.opciones}>
                    {organizaciones.map((organizacion, indice) => {
                      const elegida = organizacionId === organizacion.id;
                      return (
                        <label key={organizacion.id} className={`${styles.opcion} ${elegida ? styles.elegida : ""}`}>
                          <input
                            type="radio"
                            name="organizacion"
                            value={organizacion.id}
                            checked={elegida}
                            onChange={() => setOrganizacionId(organizacion.id)}
                            required={indice === 0}
                          />
                          <span className={styles.nombre}>
                            {organizacion.nombre}
                            {reasignando && rescate.organizacion_id === organizacion.id && (
                              <small> · actual</small>
                            )}
                          </span>
                          <dl className={styles.datos}>
                            <div>
                              <dt>Capacidad</dt>
                              <dd>{capacidad(organizacion.capacidad_kg)}</dd>
                            </div>
                            <div>
                              <dt>Refrigeración</dt>
                              <dd>{organizacion.refrigeracion ? "Sí" : "No"}</dd>
                            </div>
                            <div>
                              <dt>Horario</dt>
                              <dd>{organizacion.horario_recepcion || "Sin dato"}</dd>
                            </div>
                          </dl>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <label>
                  Voluntario
                  <select value={voluntarioId} onChange={(event) => setVoluntarioId(event.target.value)} required>
                    <option value="">Selecciona un voluntario activo</option>
                    {voluntarios.map((voluntario) => (
                      <option key={voluntario.id} value={voluntario.id}>
                        {voluntario.nombre}{voluntario.medio_transporte ? ` · ${voluntario.medio_transporte}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {reasignando && (
                  <label>
                    Motivo de reasignación
                    <textarea
                      value={motivo}
                      onChange={(event) => setMotivo(event.target.value)}
                      placeholder="Explica por qué se cambia la asignación"
                      minLength={3}
                      required
                    />
                  </label>
                )}

                {organizaciones.length === 0 && (
                  <p className={styles.aviso}>No hay organizaciones activas disponibles para asignar.</p>
                )}
                {voluntarios.length === 0 && (
                  <p className={styles.aviso}>No hay voluntarios activos disponibles para asignar.</p>
                )}

                <button type="submit" disabled={enviando || organizaciones.length === 0 || voluntarios.length === 0}>
                  {enviando ? "Guardando…" : reasignando ? "Guardar reasignación" : "Confirmar asignación"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
