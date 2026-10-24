"use client";

import Link from "next/link";
import { useState } from "react";
import { SimulacionLocal } from "@/features/simulacion/SimulacionLocal";
import type { Impacto as ImpactoDatos, TotalImpacto } from "@/types/api";
import styles from "./Impacto.module.css";
import { formatoKg, hoy, sinEntregas, textoPeriodo, validarPeriodo, type Periodo } from "./periodo";
import { useImpacto } from "./useImpacto";

/**
 * Impacto de un periodo (#52 · CA-05.1): kilogramos, personas y organizaciones, solo de rescates
 * entregados. Sin entregas, los tres totales en cero con el rango consultado (#21 · CA-05.3).
 */
export function Impacto() {
  const { estado, consultar } = useImpacto();
  const [form, setForm] = useState<Periodo>(estado.periodo);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  function alEnviar(e: React.FormEvent) {
    e.preventDefault();
    const error = validarPeriodo(form);
    setErrorForm(error);
    if (!error) consultar(form);
  }

  return (
    <div className="page">
      <SimulacionLocal alCambiar={() => consultar(estado.periodo)} />

      <div className="title-row">
        <div>
          <h1>Impacto</h1>
          <p className="finding">Solo cuentan los rescates entregados en el periodo.</p>
        </div>
      </div>

      <form className={styles.periodo} onSubmit={alEnviar} noValidate aria-label="Periodo">
        <label className={styles.fecha}>
          Desde
          <input
            className="input"
            type="date"
            value={form.desde}
            max={hoy()}
            onChange={(e) => setForm((f) => ({ ...f, desde: e.target.value }))}
          />
        </label>
        <label className={styles.fecha}>
          Hasta
          <input
            className="input"
            type="date"
            value={form.hasta}
            max={hoy()}
            onChange={(e) => setForm((f) => ({ ...f, hasta: e.target.value }))}
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={estado.tipo === "cargando"}>
          Consultar
        </button>
        {errorForm && (
          <p className={`field__error ${styles.errorForm}`} role="alert">
            {errorForm}
          </p>
        )}
      </form>

      <div aria-live="polite">
        {estado.tipo === "cargando" && <TotalesCargando />}
        {estado.tipo === "error" && (
          <div className="notice notice--error" role="alert">
            <div>
              <p>No se pudo consultar el impacto. {estado.mensaje}</p>
              <div className="notice__actions">
                <button type="button" className="btn btn--secondary btn--compact" onClick={() => consultar(estado.periodo)}>
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        )}
        {estado.tipo === "listo" && <Totales impacto={estado.impacto} periodo={estado.periodo} />}
      </div>
    </div>
  );
}

const TOTALES: { id: TotalImpacto; etiqueta: string; valor: (i: ImpactoDatos) => string; unidad: string }[] = [
  { id: "kg", etiqueta: "Kilogramos rescatados", valor: (i) => formatoKg(i.kg_rescatados), unidad: "kg" },
  { id: "personas", etiqueta: "Personas beneficiadas", valor: (i) => String(i.personas_beneficiadas), unidad: "personas" },
  { id: "organizaciones", etiqueta: "Organizaciones receptoras", valor: (i) => String(i.organizaciones_receptoras), unidad: "organizaciones" },
];

function Totales({ impacto, periodo }: { impacto: ImpactoDatos; periodo: Periodo }) {
  const vacio = sinEntregas(impacto);
  return (
    <>
      {vacio ? (
        // #21 · CA-05.3: periodo sin entregas, explícito y sin pantalla en blanco.
        <div className="notice notice--warning" role="status">
          <p>No hubo rescates entregados {textoPeriodo(periodo)}. Los totales están en cero.</p>
        </div>
      ) : (
        <p className={styles.rango}>Rescates entregados {textoPeriodo(periodo)}.</p>
      )}
      <ul className={styles.totales}>
        {TOTALES.map((t) => {
          const contenido = (
            <>
              <span className={styles.etiqueta}>{t.etiqueta}</span>
              <span className={`num ${styles.valor}`}>{vacio ? "0" : t.valor(impacto)}</span>
              {!vacio && <span className={styles.verDetalle}>Ver rescates →</span>}
            </>
          );
          return (
            <li key={t.id}>
              {vacio ? (
                <div className={styles.total}>{contenido}</div>
              ) : (
                // Cada total enlaza a su detalle. TODO(#22): esa pantalla la construye la issue #22.
                <Link
                  className={`${styles.total} ${styles.enlace}`}
                  href={`/fundacion/impacto/detalle?total=${t.id}&desde=${periodo.desde}&hasta=${periodo.hasta}`}
                  aria-label={`${t.etiqueta}: ${t.valor(impacto)} ${t.unidad}. Ver los rescates que lo componen`}
                >
                  {contenido}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function TotalesCargando() {
  return (
    <ul className={styles.totales} aria-busy="true" aria-label="Consultando">
      {TOTALES.map((t) => (
        <li key={t.id}>
          <div className={styles.total}>
            <span className={styles.etiqueta}>{t.etiqueta}</span>
            <span className="skeleton" style={{ width: 90, height: 36 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
