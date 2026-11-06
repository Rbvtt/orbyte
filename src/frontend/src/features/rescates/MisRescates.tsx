"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { dia, hora24 } from "@/features/rescates/tiempo";
import { useAhora } from "@/features/rescates/useAhora";
import { ApiError } from "@/services/api/client";
import { rescatesApi } from "@/services/api/rescates";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";
import type { RolUsuario } from "@/types/api";
import type { RescateLista } from "@/types/rescates";
import styles from "./MisRescates.module.css";

export function MisRescates() {
  const router = useRouter();
  const ahora = useAhora();
  const [rescates, setRescates] = useState<RescateLista[] | null>(null);
  const [error, setError] = useState("");
  const [rol, setRol] = useState<RolUsuario | null>(null);
  const [recepcionId, setRecepcionId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [esMedida, setEsMedida] = useState(true);
  const [personas, setPersonas] = useState("");
  const [accion, setAccion] = useState("");

  useEffect(() => {
    let vigente = true;
    const controlador = new AbortController();

    async function cargar() {
      try {
        if (!leerToken()) {
          router.replace("/login");
          return;
        }
        const usuario = await sesionApi.me();
        if (usuario.rol !== "voluntario" && usuario.rol !== "organizacion") {
          router.replace("/home");
          return;
        }
        if (vigente) setRol(usuario.rol);
        const lista = await rescatesApi.misAsignaciones(controlador.signal);
        if (vigente) {
          setRescates(lista);
          setError("");
        }
      } catch (reason) {
        if (!vigente || (reason instanceof Error && reason.name === "AbortError")) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : "No se pudieron cargar tus rescates.");
      }
    }

    void cargar();
    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [router]);

  const recargar = useCallback(async () => {
    try {
      setRescates(await rescatesApi.misAsignaciones());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron actualizar tus rescates.");
    }
  }, []);

  useEffect(() => {
    if (!rol) return;
    const alVolver = () => {
      if (document.visibilityState === "visible") void recargar();
    };
    const intervalo = window.setInterval(alVolver, 30_000);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [recargar, rol]);

  async function marcarEntregado(id: string) {
    setAccion(id);
    setError("");
    try {
      await rescatesApi.marcarEntregado(id);
      await recargar();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la entrega.");
    } finally {
      setAccion("");
    }
  }

  async function confirmarRecepcion(id: string) {
    const cantidadRecibida = Number(cantidad);
    const beneficiarios = personas === "" ? undefined : Number(personas);
    if (!Number.isFinite(cantidadRecibida) || cantidadRecibida <= 0) {
      setError("Ingresa una cantidad recibida mayor que cero.");
      return;
    }
    if (beneficiarios !== undefined && (!Number.isInteger(beneficiarios) || beneficiarios < 0)) {
      setError("La cantidad de personas beneficiadas debe ser un número entero igual o mayor que cero.");
      return;
    }
    setAccion(id);
    setError("");
    try {
      await rescatesApi.confirmarRecepcion(id, {
        cantidad_recibida: cantidadRecibida,
        unidad_recibida: esMedida ? "kg" : "aproximada",
        es_medida: esMedida,
        ...(beneficiarios !== undefined ? { personas_beneficiadas: beneficiarios } : {}),
      });
      setRecepcionId(null);
      setCantidad("");
      setPersonas("");
      await recargar();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo confirmar la recepción.");
    } finally {
      setAccion("");
    }
  }

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <Link className={styles.volver} href="/home">← Volver a mi inicio</Link>
        <header className={styles.hero}>
          <span className={styles.kicker}>Coordinación de alimentos</span>
          <h1>Mis rescates asignados</h1>
          <p>{rol === "organizacion"
            ? "Revisa quién envía cada donación, quién la asignó y quién la entrega."
            : "Consulta dónde recoger cada donación y la dirección donde debes entregarla."}</p>
        </header>

        {error && <div className="notice notice--error" role="alert">{error}</div>}

        {rescates === null ? (
          <p className={styles.estado} role="status">Cargando tus asignaciones…</p>
        ) : rescates.length === 0 ? (
          <section className={styles.vacio}>
            <span className={styles.vacioIcono} aria-hidden="true">✓</span>
            <h2>No tienes rescates activos asignados</h2>
            <p>Cuando la Fundación asigne un rescate a tu usuario u organización, aparecerá aquí.</p>
          </section>
        ) : (
          <section className={styles.lista} aria-label="Rescates asignados">
            {rescates.map((rescate) => (
              <article className={styles.tarjeta} key={rescate.id}>
                <div className={styles.tarjetaCabecera}>
                  <div>
                    <span className={styles.kicker}>{rol === "organizacion" ? "Comercio donante" : "Entrega asignada"}</span>
                    <h2>{rol === "organizacion" ? rescate.comercio : `Donación para ${rescate.organizacion ?? "la organización"}`}</h2>
                  </div>
                  <StatusPill estado={rescate.estado_visual ?? (
                    rol === "organizacion"
                      ? rescate.estado === "entregado" ? "recibido" : "por_recibir"
                      : rescate.estado === "recogido" ? "entregado_por_voluntario" : rescate.estado
                  )} />
                </div>
                <dl className={styles.datos}>
                  {rol === "voluntario" ? (
                    <>
                      <div><dt>Recoger en</dt><dd>{rescate.lugar_recogida}</dd></div>
                      <div><dt>Entregar en</dt><dd>{rescate.organizacion} · {rescate.lugar_entrega}</dd></div>
                      <div><dt>Cantidad aproximada</dt><dd>{rescate.cantidad_aprox}</dd></div>
                      <div><dt>Hora límite</dt><dd>{dia(rescate.hora_limite, ahora)}, {hora24(new Date(rescate.hora_limite))}</dd></div>
                    </>
                  ) : (
                    <>
                      <div><dt>Fundación asignadora</dt><dd>{rescate.fundacion ?? "No disponible"}</dd></div>
                      <div><dt>Voluntario que entrega</dt><dd>{rescate.voluntario ?? "Sin voluntario asignado"}</dd></div>
                    </>
                  )}
                </dl>
                {rol === "voluntario" && rescate.estado === "asignado" && (
                  <button className={styles.accion} type="button" disabled={accion === rescate.id} onClick={() => void marcarEntregado(rescate.id)}>
                    {accion === rescate.id ? "Guardando…" : "Marcar donación entregada"}
                  </button>
                )}
                {rol === "organizacion" && rescate.estado === "recogido" && recepcionId !== rescate.id && (
                  <button className={styles.accion} type="button" onClick={() => setRecepcionId(rescate.id)}>
                    Confirmar recepción
                  </button>
                )}
                {rol === "organizacion" && rescate.estado === "asignado" && (
                  <p className={styles.espera}>El voluntario aún no ha marcado la donación como entregada.</p>
                )}
                {rol === "organizacion" && recepcionId === rescate.id && (
                  <form className={styles.formulario} onSubmit={(event) => { event.preventDefault(); void confirmarRecepcion(rescate.id); }}>
                    <label>
                      Cantidad recibida
                      <input type="number" min="0.01" step="0.01" required value={cantidad} onChange={(event) => setCantidad(event.target.value)} />
                    </label>
                    <label>
                      Tipo de cantidad
                      <select value={esMedida ? "medida" : "aproximada"} onChange={(event) => setEsMedida(event.target.value === "medida")}>
                        <option value="medida">Medida en kilogramos</option>
                        <option value="aproximada">Cantidad aproximada</option>
                      </select>
                    </label>
                    <label>
                      Personas beneficiadas (opcional)
                      <input type="number" min="0" step="1" value={personas} onChange={(event) => setPersonas(event.target.value)} />
                    </label>
                    <div className={styles.formularioAcciones}>
                      <button className={styles.accion} type="submit" disabled={accion === rescate.id}>
                        {accion === rescate.id ? "Guardando…" : "Marcar como recibido"}
                      </button>
                      <button className={styles.cancelar} type="button" onClick={() => setRecepcionId(null)}>Cancelar</button>
                    </div>
                  </form>
                )}
                <Link className={styles.detalle} href={`/rescates/${rescate.id}`}>Ver detalles <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
