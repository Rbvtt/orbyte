"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconoCheckCirculo } from "@/components/ui/Iconos";
import { impactoApi } from "@/services/api/impacto";
import type { ImpactoDetalle, MetricaImpacto, RescateImpactoDetalle } from "@/types/impacto";
import { consultaPeriodo, leerPeriodo, METRICAS_VALIDAS, textoPeriodo } from "./periodo";
import { useSoloFundacion } from "./useSoloFundacion";
import styles from "./DetalleImpacto.module.css";

/**
 * #22 · CA-05.2 (RF-021). Rescates que componen un total del impacto. Es la página a la que
 * enlaza cada total de /fundacion/impacto (#52): /fundacion/impacto/detalle?metrica=…&desde=…&hasta=…
 */

const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const fechaEntrega = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

const TITULOS: Record<MetricaImpacto, { titulo: string; unidad: string }> = {
  kg: { titulo: "Kilogramos rescatados", unidad: "kg" },
  personas: { titulo: "Personas beneficiadas", unidad: "atenciones" },
  organizaciones: { titulo: "Organizaciones receptoras participantes", unidad: "organizaciones" },
  sin_kg: { titulo: "Rescates con cantidad estimada", unidad: "rescates" },
};

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

export function DetalleImpacto() {
  useSoloFundacion();
  const params = useSearchParams();
  const periodo = leerPeriodo(params);
  const metricaUrl = params.get("metrica");
  const metrica = METRICAS_VALIDAS.find((m) => m === metricaUrl) ?? null;
  const clave = periodo && metrica ? `${metrica}|${periodo.desde}|${periodo.hasta}` : "";
  const [resultado, setResultado] = useState<{ clave: string; detalle?: ImpactoDetalle; error?: string } | null>(
    null,
  );

  useEffect(() => {
    if (!clave) return;
    const [m, desde, hasta] = clave.split("|");
    let vigente = true;
    impactoApi
      .detalle(m as MetricaImpacto, desde, hasta)
      .then((detalle) => {
        if (vigente) setResultado({ clave, detalle });
      })
      .catch((reason) => {
        if (vigente) {
          setResultado({ clave, error: reason instanceof Error ? reason.message : "No se pudo cargar el detalle." });
        }
      });
    return () => {
      vigente = false;
    };
  }, [clave]);

  const volver = periodo ? `/fundacion/impacto?${consultaPeriodo(periodo)}` : "/fundacion/impacto";
  const actual = resultado?.clave === clave ? resultado : null;
  const detalle = actual?.detalle ?? null;
  const filas = detalle ? detalleRescates(detalle) : [];
  const suma = detalle ? valorRespaldado(detalle) : 0;
  const sumaValida = detalle ? Math.abs(suma - detalle.total) < 0.000001 : false;
  const info = metrica ? TITULOS[metrica] : null;

  return (
    <main className={styles.pagina}>
      <Link href={volver} className={`btn btn--secondary btn--compact ${styles.volver}`}>
        ← Volver al resumen
      </Link>
      <span className={styles.kicker}>Impacto / detalle</span>
      <h1 className={styles.titulo}>{info?.titulo ?? "Detalle del impacto"}</h1>

      {!periodo || !metrica ? (
        <div className="notice notice--error" role="alert">
          El enlace del detalle no es válido. Vuelve al resumen y elige un total.
        </div>
      ) : (
        <>
          <div className={styles.periodo}>
            <div>
              <span className={styles.etiqueta}>Periodo consultado</span>
              <strong>{textoPeriodo(periodo)}</strong>
            </div>
            <span className={styles.chip}>
              <IconoCheckCirculo tamano={16} /> Solo rescates entregados
            </span>
          </div>

          {actual?.error && (
            <div className="notice notice--error" role="alert">
              {actual.error}
            </div>
          )}

          {!actual && (
            <p className={styles.estado} role="status">
              Cargando rescates que componen la cifra…
            </p>
          )}

          {detalle && info && (
            <section className={`panel ${styles.detalle}`} aria-labelledby="detalle-titulo">
              <div className={styles.detalleCabecera}>
                <div>
                  <h2 id="detalle-titulo">Rescates que componen el total</h2>
                  <p>{filas.length} rescates entregados que respaldan el indicador.</p>
                </div>
                <strong>
                  {numero.format(detalle.total)} {info.unidad}
                </strong>
              </div>
              <p
                className={`${styles.verificacion} ${sumaValida ? styles.verificacionCorrecta : styles.verificacionError}`}
                role="status"
              >
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
                          <td title={rescate.id} className={styles.id}>
                            {rescate.id.slice(0, 8)}
                          </td>
                          <td>{fechaEntrega.format(new Date(rescate.entregado_en))}</td>
                          <td>{rescate.comercio}</td>
                          <td>{rescate.organizacion}</td>
                          <td>
                            {numero.format(rescate.cantidad_recibida)} {rescate.unidad_recibida === "kg" ? "kg" : "aprox"}
                          </td>
                          <td>{rescate.es_medida ? "Medida" : "Estimada"}</td>
                          <td>
                            {rescate.personas_beneficiadas === null ? "—" : numero.format(rescate.personas_beneficiadas)}
                          </td>
                          <td>
                            <Link href={`/rescates/${rescate.id}`}>Ver historial</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
