"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { impactoApi } from "@/services/api/impacto";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";
import type {
  ImpactoDetalle,
  ImpactoResumen,
  MetricaImpacto,
  RescateImpactoDetalle,
} from "@/types/impacto";
import styles from "./ConsultaImpacto.module.css";

const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const fechaEntrega = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

const METRICAS: {
  clave: MetricaImpacto;
  titulo: string;
  valor: (resumen: ImpactoResumen) => number;
  unidad: string;
}[] = [
  { clave: "kg", titulo: "Kilogramos medidos", valor: (r) => r.kg_total, unidad: "kg" },
  { clave: "personas", titulo: "Personas beneficiadas", valor: (r) => r.personas_total, unidad: "personas" },
  { clave: "organizaciones", titulo: "Organizaciones receptoras", valor: (r) => r.organizaciones.length, unidad: "organizaciones" },
  { clave: "sin_kg", titulo: "Rescates estimados", valor: (r) => r.rescates_sin_kg, unidad: "rescates sin kg" },
];

function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function detalleRescates(detalle: ImpactoDetalle): RescateImpactoDetalle[] {
  if (detalle.metrica === "organizaciones") {
    return detalle.organizaciones.flatMap((organizacion) => organizacion.rescates);
  }
  return detalle.rescates;
}

function valorRespaldado(detalle: ImpactoDetalle): number {
  if (detalle.metrica === "organizaciones") {
    return detalle.organizaciones.reduce((suma, organizacion) => suma + organizacion.valor, 0);
  }
  return detalle.rescates.reduce((suma, rescate) => suma + (rescate.valor ?? 0), 0);
}

export function ConsultaImpacto() {
  const router = useRouter();
  const [hoy] = useState(() => hoyColombia());
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(hoy);
  const [periodo, setPeriodo] = useState<{ desde: string; hasta: string } | null>(null);
  const [resumen, setResumen] = useState<ImpactoResumen | null>(null);
  const [metrica, setMetrica] = useState<MetricaImpacto | null>(null);
  const [detalle, setDetalle] = useState<ImpactoDetalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    if (!leerToken()) {
      router.replace("/login");
      return () => {
        vigente = false;
      };
    }
    sesionApi.me().then((usuario) => {
      if (vigente && usuario.rol !== "administrador") router.replace("/home");
    }).catch(() => {
      if (vigente) router.replace("/login");
    });
    return () => {
      vigente = false;
    };
  }, [router]);

  async function consultar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!desde || !hasta) {
      setError("Selecciona la fecha inicial y la fecha final.");
      return;
    }
    if (desde > hasta) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    setCargando(true);
    setError("");
    setResumen(null);
    setDetalle(null);
    setMetrica(null);
    try {
      const resultado = await impactoApi.resumen(desde, hasta);
      setResumen(resultado);
      setPeriodo({ desde, hasta });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo consultar el impacto.");
    } finally {
      setCargando(false);
    }
  }

  async function consultarDetalle(seleccion: MetricaImpacto) {
    if (!periodo) return;
    setMetrica(seleccion);
    setDetalle(null);
    setError("");
    setCargandoDetalle(true);
    try {
      setDetalle(await impactoApi.detalle(seleccion, periodo.desde, periodo.hasta));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el detalle.");
    } finally {
      setCargandoDetalle(false);
    }
  }

  const filas = detalle ? detalleRescates(detalle) : [];
  const suma = detalle ? valorRespaldado(detalle) : 0;
  const sumaValida = detalle ? Math.abs(suma - detalle.total) < 0.000001 : false;

  return (
    <main className={styles.pagina}>
      <header className={styles.encabezado}>
        <span className={styles.kicker}>Administración · reportes</span>
        <h1>Impacto del periodo</h1>
        <p>Consulta las donaciones entregadas y abre el respaldo de cada indicador.</p>
      </header>

      <form className={`panel ${styles.filtros}`} onSubmit={(event) => void consultar(event)}>
        <label className="field">
          <span className="field__label">Desde</span>
          <input className="input" type="date" value={desde} max={hasta || undefined} onChange={(event) => setDesde(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Hasta</span>
          <input className="input" type="date" value={hasta} min={desde || undefined} onChange={(event) => setHasta(event.target.value)} required />
        </label>
        <button className="btn btn--primary" type="submit" disabled={cargando}>
          {cargando ? "Consultando…" : "Consultar periodo"}
        </button>
      </form>

      {error && <div className="notice notice--error" role="alert">{error}</div>}

      {resumen && periodo && (
        <section className={styles.resultados} aria-labelledby="resumen-titulo">
          <div className={styles.resultadoCabecera}>
            <div>
              <h2 id="resumen-titulo">Resumen del impacto</h2>
              <p>{fechaEntrega.format(new Date(`${periodo.desde}T12:00:00-05:00`))} – {fechaEntrega.format(new Date(`${periodo.hasta}T12:00:00-05:00`))}</p>
            </div>
            <span>{resumen.organizaciones.length} organizaciones receptoras</span>
          </div>

          <div className={styles.tarjetas}>
            {METRICAS.map((item) => {
              const cantidad = item.valor(resumen);
              return (
                <button
                  type="button"
                  key={item.clave}
                  className={`${styles.tarjeta} ${metrica === item.clave ? styles.tarjetaActiva : ""}`}
                  aria-pressed={metrica === item.clave}
                  onClick={() => void consultarDetalle(item.clave)}
                >
                  <span>{item.titulo}</span>
                  <strong>{numero.format(cantidad)}</strong>
                  <small>{item.unidad} · Ver respaldo →</small>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {cargandoDetalle && <p className={styles.estado} role="status">Cargando rescates que componen la cifra…</p>}

      {detalle && metrica && (
        <section className={`panel ${styles.detalle}`} aria-labelledby="detalle-titulo">
          <div className={styles.detalleCabecera}>
            <div>
              <h2 id="detalle-titulo">{METRICAS.find((item) => item.clave === metrica)?.titulo}</h2>
              <p>{filas.length} rescates que respaldan el indicador.</p>
            </div>
            <strong>{numero.format(detalle.total)} {METRICAS.find((item) => item.clave === metrica)?.unidad}</strong>
          </div>
          <p className={`${styles.verificacion} ${sumaValida ? styles.verificacionCorrecta : styles.verificacionError}`} role="status">
            {sumaValida
              ? `La suma del detalle coincide con el total: ${numero.format(suma)}.`
              : `El respaldo suma ${numero.format(suma)} y no coincide con el total ${numero.format(detalle.total)}.`}
          </p>
          {filas.length === 0 ? (
            <p className={styles.vacio}>No hay rescates que respalden esta cifra en el periodo.</p>
          ) : (
            <div className={styles.tablaContenedor}>
              <table className={styles.tabla}>
                <caption className="sr-only">Rescates que componen el indicador seleccionado</caption>
                <thead>
                  <tr>
                    <th scope="col">Rescate</th>
                    <th scope="col">Fecha de entrega</th>
                    <th scope="col">Comercio</th>
                    <th scope="col">Organización</th>
                    <th scope="col">Cantidad recibida</th>
                    <th scope="col">Medición</th>
                    <th scope="col">Beneficiados</th>
                    <th scope="col">Historial</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((rescate) => (
                    <tr key={rescate.id}>
                      <td title={rescate.id} className={styles.id}>{rescate.id.slice(0, 8)}</td>
                      <td>{fechaEntrega.format(new Date(rescate.entregado_en))}</td>
                      <td>{rescate.comercio}</td>
                      <td>{rescate.organizacion}</td>
                      <td>{numero.format(rescate.cantidad_recibida)} {rescate.unidad_recibida === "kg" ? "kg" : "aprox"}</td>
                      <td>{rescate.es_medida ? "Medida" : "Estimada"}</td>
                      <td>{rescate.personas_beneficiadas === null ? "—" : numero.format(rescate.personas_beneficiadas)}</td>
                      <td><Link href={`/rescates/${rescate.id}`}>Ver historial</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
