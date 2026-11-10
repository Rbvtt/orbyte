"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api/client";
import { useAhora } from "@/features/rescates/useAhora";
import { leerToken } from "@/services/api/sesion";
import { rescatesApi } from "@/services/api/rescates";
import { sesionApi } from "@/services/api/sesionApi";
import type { OrganizacionReceptora, Voluntario } from "@/types/api";
import type { RescateDetalle } from "@/types/rescates";
import styles from "./asignar.module.css";

export default function AsignarRescatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rescate, setRescate] = useState<RescateDetalle | null>(null);
  const [organizaciones, setOrganizaciones] = useState<OrganizacionReceptora[]>([]);
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([]);
  const [organizacionId, setOrganizacionId] = useState("");
  const [voluntarioId, setVoluntarioId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const ahora = useAhora();

  useEffect(() => {
    let activo = true;
    if (!leerToken()) {
      router.replace("/login");
      return () => {
        activo = false;
      };
    }

    async function cargar() {
      try {
        const usuario = await sesionApi.me();
        if (usuario.rol !== "fundacion") {
          router.replace("/home");
          return;
        }
        const [detalle, listaOrganizaciones, listaVoluntarios] = await Promise.all([
          rescatesApi.detalle(id),
          sesionApi.organizaciones(),
          sesionApi.voluntarios(),
        ]);
        if (!activo) return;
        setRescate(detalle);
        setOrganizaciones(listaOrganizaciones);
        setVoluntarios(listaVoluntarios);
        setOrganizacionId(detalle.organizacion_id ?? "");
        setVoluntarioId(detalle.voluntario_id ?? "");
      } catch (reason) {
        if (!activo) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : "No se pudo cargar la asignación.");
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => {
      activo = false;
    };
  }, [id, router]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const datos = {
        organizacion_id: organizacionId,
        voluntario_id: voluntarioId,
      };
      await rescatesApi.asignar(id, datos);
      router.push(`/rescates/${id}`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "No se pudo guardar la asignación.");
    } finally {
      setEnviando(false);
    }
  }

  const vencido = rescate?.hora_limite ? Date.parse(rescate.hora_limite) <= ahora.getTime() : false;
  const estadoValido = rescate?.estado === "disponible";

  if (cargando) {
    return <main className={styles.pagina}><p className={styles.estado}>Cargando rescate…</p></main>;
  }

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <Link href="/fundacion/rescates" className={styles.volver}>← Volver a rescates</Link>
        <section className={styles.tarjeta}>
          <span className={styles.kicker}>Coordinación de rescates</span>
          <h1>Asignar rescate</h1>
          <p className={styles.descripcion}>
            Asigna una organización receptora y un voluntario activo para coordinar la donación.
          </p>

          {error && <div className={styles.error} role="alert">{error}</div>}

          {!rescate && !error ? (
            <p className={styles.estado}>No se encontró el rescate.</p>
          ) : !estadoValido || vencido ? (
            <div className={styles.aviso} role="status">
              Este rescate ya no está disponible para asignación.
              <Link href={`/rescates/${id}`}>Consultar detalle</Link>
            </div>
          ) : (
            <>
              <div className={styles.resumen}>
                <strong>{rescate.alimento || "Donación"}</strong>
                <span>{rescate.cantidad_aprox}</span>
                <span>Recoger en: {rescate.lugar_recogida}</span>
              </div>

              <form className={styles.formulario} onSubmit={guardar}>
                <label>
                  Organización receptora
                  <select value={organizacionId} onChange={(event) => setOrganizacionId(event.target.value)} required>
                    <option value="">Selecciona una organización</option>
                    {organizaciones.map((organizacion) => (
                      <option key={organizacion.id} value={organizacion.id}>{organizacion.nombre}</option>
                    ))}
                  </select>
                </label>

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

                {organizaciones.length === 0 && (
                  <p className={styles.aviso}>No hay organizaciones activas disponibles para asignar.</p>
                )}
                {voluntarios.length === 0 && (
                  <p className={styles.aviso}>No hay voluntarios activos disponibles para asignar.</p>
                )}

                <button type="submit" disabled={enviando || organizaciones.length === 0 || voluntarios.length === 0}>
                  {enviando ? "Guardando…" : "Confirmar asignación"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
