"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/services/api/client";
import { rescatesApi } from "@/services/api/rescates";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";
import type { UsuarioSesion } from "@/types/api";
import type { RescateDetalle } from "@/types/rescates";
import styles from "./ConfirmarRecepcion.module.css";

const fechaColombia = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export function ConfirmarRecepcion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [rescate, setRescate] = useState<RescateDetalle | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState<"kg" | "aprox">("kg");
  const [esMedida, setEsMedida] = useState(true);
  const [personas, setPersonas] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    const controlador = new AbortController();

    async function cargar() {
      if (!leerToken()) {
        router.replace("/login");
        return;
      }
      try {
        const [sesion, detalle] = await Promise.all([
          sesionApi.me(),
          rescatesApi.detalle(id, controlador.signal),
        ]);
        if (!vigente) return;
        if (sesion.rol !== "organizacion") {
          setError("Esta pantalla es exclusiva de la organización receptora.");
          return;
        }
        setUsuario(sesion);
        setRescate(detalle);
        setPersonas(
          detalle.personas_beneficiadas === null || detalle.personas_beneficiadas === undefined
            ? ""
            : String(detalle.personas_beneficiadas),
        );
      } catch (reason) {
        if (!vigente || (reason instanceof Error && reason.name === "AbortError")) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace("/login");
          return;
        }
        setError(
          reason instanceof ApiError && (reason.status === 403 || reason.status === 404)
            ? "No puedes confirmar la recepción de este rescate."
            : reason instanceof Error
              ? reason.message
              : "No se pudo cargar el rescate.",
        );
      } finally {
        if (vigente) setCargando(false);
      }
    }

    void cargar();
    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [id, router]);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!usuario || !rescate) return;
    const beneficiarios = Number(personas);
    if (personas.trim() === "" || !Number.isSafeInteger(beneficiarios) || beneficiarios < 0) {
      setError("Ingresa un número entero de personas beneficiadas igual o mayor que cero.");
      return;
    }
    if (rescate.estado === "recogido") {
      const recibida = Number(cantidad);
      if (!Number.isFinite(recibida) || recibida <= 0) {
        setError("Ingresa una cantidad recibida mayor que cero.");
        return;
      }
    }

    setGuardando(true);
    setError("");
    let entregaConfirmada = rescate.estado === "entregado";
    try {
      if (rescate.estado === "recogido") {
        const recibida = Number(cantidad);
        const entrega = await rescatesApi.confirmarEntrega(id, {
          recibido_por: usuario.id,
          cantidad_recibida: recibida,
          unidad,
          es_medida: esMedida,
        });
        entregaConfirmada = true;
        setRescate((actual) =>
          actual
            ? {
                ...actual,
                estado: entrega.estado,
                cantidad_recibida: entrega.cantidad_recibida,
                unidad_recibida: entrega.unidad,
                es_medida: entrega.es_medida,
                entregado_en: entrega.entregado_en,
                recibido_por_nombre: usuario.nombre,
              }
            : actual,
        );
      }
      const actualizado = await rescatesApi.actualizarBeneficiados(id, beneficiarios);
      setRescate((actual) =>
        actual ? { ...actual, personas_beneficiadas: actualizado.personas_beneficiadas } : actual,
      );
      setPersonas(String(actualizado.personas_beneficiadas));
      setGuardado(true);
    } catch (reason) {
      const mensaje = reason instanceof Error ? reason.message : "No se pudo guardar la recepción.";
      setError(
        entregaConfirmada
          ? `La recepción ya quedó confirmada, pero no se pudo guardar el conteo de beneficiados. ${mensaje}`
          : mensaje,
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <main className={styles.pagina}><p role="status">Cargando rescate…</p></main>;
  }
  if (error && !rescate) {
    return (
      <main className={styles.pagina}>
        <div className="notice notice--error" role="alert">{error}</div>
        <Link className={styles.volver} href="/mis-rescates">Volver a mis rescates</Link>
      </main>
    );
  }
  if (!usuario || !rescate) return null;

  const esRecepcion = rescate.estado === "recogido";
  const yaEntregado = rescate.estado === "entregado";
  if (!esRecepcion && !yaEntregado) {
    return (
      <main className={styles.pagina}>
        <header className={styles.encabezado}>
          <span className={styles.kicker}>Organización receptora</span>
          <h1>Recepción no disponible</h1>
          <p>El voluntario debe marcar el rescate como recogido antes de confirmar la recepción.</p>
        </header>
        <div className="notice notice--warning" role="status">Este rescate todavía no está listo para recibirse.</div>
        <Link className={styles.volver} href="/mis-rescates">Volver a mis rescates</Link>
      </main>
    );
  }

  if (guardado && yaEntregado) {
    return (
      <main className={styles.pagina}>
        <section className={styles.confirmacion} aria-labelledby="confirmacion-titulo">
          <span className={styles.confirmacionIcono} aria-hidden="true">✓</span>
          <h1 id="confirmacion-titulo">Recepción confirmada</h1>
          <p>El rescate quedó entregado.</p>
          <span className={styles.estado}>✓ Entregado</span>
        </section>
        <div className={styles.resumen}>
          <section className="panel" aria-labelledby="datos-registrados">
            <div className="panel__header"><h2 id="datos-registrados">Datos registrados</h2></div>
            <dl className={styles.datos}>
              <div><dt>Recibido por</dt><dd>{rescate.recibido_por_nombre ?? usuario.nombre}</dd></div>
              <div><dt>Cantidad recibida</dt><dd>{rescate.cantidad_recibida ?? cantidad}</dd></div>
              <div><dt>Tipo de cantidad</dt><dd>{rescate.unidad_recibida === "aprox" ? "Cantidad aproximada (aprox)" : "Kilogramos (kg)"}</dd></div>
              <div><dt>Origen del valor</dt><dd>{rescate.es_medida ? "Medida" : "Estimada"}</dd></div>
              <div><dt>Personas beneficiadas</dt><dd>{rescate.personas_beneficiadas} personas</dd></div>
              {rescate.entregado_en && <div><dt>Fecha y hora</dt><dd>{fechaColombia.format(new Date(rescate.entregado_en))}</dd></div>}
            </dl>
          </section>
          <aside className={styles.tarjeta}>
            <h2>{rescate.comercio ?? "Donación recibida"}</h2>
            <p>{rescate.alimento ?? "Rescate"} · referencia {rescate.cantidad_aprox ?? "no disponible"}</p>
            <p>Organización receptora: {rescate.organizacion ?? "Tu organización"}</p>
          </aside>
        </div>
        <div className={styles.pie}>
          <p>Solo registramos el total de personas, sin nombres ni datos personales.</p>
          <Link className="btn btn--primary" href="/mis-rescates">Volver a mis rescates →</Link>
          <button type="button" className="btn btn--secondary" onClick={() => setGuardado(false)}>Editar conteo</button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.pagina}>
      <Link className={styles.volver} href="/mis-rescates">Mis rescates</Link>
      <header className={styles.encabezado}>
        <span className={styles.kicker}>Organización receptora</span>
        <h1>{yaEntregado ? "Actualizar beneficiados" : "Confirmar recepción"}</h1>
        <p>{yaEntregado
          ? "Registra o corrige el total de personas atendidas. El valor anterior se conservará en el historial."
          : "Registra lo recibido y el total de personas beneficiadas."}</p>
      </header>

      {error && <div className="notice notice--error" role="alert">{error}</div>}

      <form className={styles.panel} onSubmit={(event) => void enviar(event)}>
        <section className={styles.resumenRescate} aria-labelledby="rescate-titulo">
          <h2 id="rescate-titulo">Rescate {rescate.alimento ? `· ${rescate.alimento}` : ""}</h2>
          <p>Comercio de origen: <strong>{rescate.comercio ?? "No disponible"}</strong></p>
          <p>Organización receptora: <strong>{rescate.organizacion ?? "Tu organización"}</strong></p>
          {rescate.cantidad_aprox && <p>Referencia del rescate: <strong>{rescate.cantidad_aprox}</strong></p>}
          <span className={styles.estado}>{yaEntregado ? "✓ Entregado" : "Recogido · pendiente de recepción"}</span>
        </section>

        <div className={styles.campos}>
          {!yaEntregado && (
            <>
              <label className="field">
                <span className="field__label">Recibido por</span>
                <input className="input" value={usuario.nombre} readOnly />
                <span className={styles.ayuda}>Persona de tu organización que recibe la donación.</span>
              </label>
              <label className="field">
                <span className="field__label">Cantidad recibida</span>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="any"
                  inputMode="decimal"
                  required
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                  aria-describedby="ayuda-cantidad"
                />
                <span className={styles.ayuda} id="ayuda-cantidad">Cantidad real recibida, mayor que cero.</span>
              </label>
              <fieldset className={styles.opciones}>
                <legend>Tipo de cantidad</legend>
                <label><input type="radio" name="unidad" checked={unidad === "kg"} onChange={() => { setUnidad("kg"); setEsMedida(true); }} /> Kilogramos (kg)</label>
                <label><input type="radio" name="unidad" checked={unidad === "aprox"} onChange={() => { setUnidad("aprox"); setEsMedida(false); }} /> Cantidad aproximada (aprox)</label>
              </fieldset>
              <fieldset className={styles.opciones}>
                <legend>¿Medida o estimada?</legend>
                <label><input type="radio" name="medicion" checked={esMedida} onChange={() => { setEsMedida(true); setUnidad("kg"); }} /> Medida</label>
                <label><input type="radio" name="medicion" checked={!esMedida} onChange={() => { setEsMedida(false); setUnidad("aprox"); }} /> Estimada</label>
              </fieldset>
            </>
          )}
          <label className="field">
            <span className="field__label">Personas beneficiadas</span>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              required
              value={personas}
              onChange={(event) => setPersonas(event.target.value)}
              aria-describedby="ayuda-beneficiados"
            />
            <span className={styles.ayuda} id="ayuda-beneficiados">Solo el total entero; no incluyas nombres ni datos personales.</span>
          </label>
        </div>

        <footer className={styles.formularioPie}>
          <p>{yaEntregado ? "El valor anterior se mantiene en el historial al corregirlo." : "Al confirmar, el rescate quedará entregado."}</p>
          <button className="btn btn--primary" type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : yaEntregado ? "Guardar beneficiados →" : "Confirmar recepción →"}
          </button>
        </footer>
      </form>
    </main>
  );
}
