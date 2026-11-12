"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconoBalanza,
  IconoBuscar,
  IconoCheckCirculo,
  IconoFlecha,
  IconoInfo,
  IconoPersonaCheck,
  IconoTienda,
} from "@/components/ui/Iconos";
import { impactoApi } from "@/services/api/impacto";
import type { ImpactoResumen, MetricaImpacto } from "@/types/impacto";
import { consultaPeriodo, leerPeriodo, type Periodo, periodoPorDefecto, textoPeriodo } from "./periodo";
import { useSoloFundacion } from "./useSoloFundacion";
import styles from "./ConsultaImpacto.module.css";

/**
 * #52 · CMP-05 · CA-05.1 (RF-018, RF-019, RF-020). Vista /fundacion/impacto según el diseño #19:
 * periodo de entrega, los tres totales del periodo (GET /api/v1/impacto, #51) y, en cada total,
 * el enlace a los rescates que lo componen (#22). El periodo vive en la URL (?desde=…&hasta=…)
 * para que «Volver al resumen» del detalle regrese al mismo periodo.
 */

const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

const TOTALES: {
  metrica: MetricaImpacto;
  titulo: string;
  unidad?: string;
  ayuda: string;
  icono: typeof IconoBalanza;
  valor: (r: ImpactoResumen) => number;
}[] = [
  {
    metrica: "kg",
    titulo: "Kilogramos rescatados",
    unidad: "kg",
    ayuda: "Peso de las entregas pesadas en báscula",
    icono: IconoBalanza,
    valor: (r) => r.kg_total,
  },
  {
    metrica: "personas",
    titulo: "Personas beneficiadas",
    ayuda: "Atenciones; no personas únicas",
    icono: IconoPersonaCheck,
    valor: (r) => r.personas_total,
  },
  {
    metrica: "organizaciones",
    titulo: "Organizaciones receptoras participantes",
    ayuda: "Receptoras distintas en el periodo",
    icono: IconoTienda,
    valor: (r) => r.organizaciones.length,
  },
];

function FormularioPeriodo({ periodo, onConsultar }: { periodo: Periodo; onConsultar: (p: Periodo) => void }) {
  const [desde, setDesde] = useState(periodo.desde);
  const [hasta, setHasta] = useState(periodo.hasta);
  const [error, setError] = useState("");

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!desde || !hasta) {
      setError("Elige la fecha de inicio y la fecha de fin.");
      return;
    }
    if (desde > hasta) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }
    setError("");
    onConsultar({ desde, hasta });
  }

  return (
    <form className={`panel ${styles.filtros}`} onSubmit={enviar} noValidate aria-labelledby="periodo-titulo">
      <h2 id="periodo-titulo" className={styles.filtrosTitulo}>
        Periodo de entrega
      </h2>
      <div className={styles.campos}>
        <label className="field">
          <span className="field__label">Fecha de inicio</span>
          <input
            className="input"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={(event) => setDesde(event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Fecha de fin</span>
          <input
            className="input"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={(event) => setHasta(event.target.value)}
            aria-invalid={Boolean(error) || undefined}
            required
          />
        </label>
        <button className={`btn btn--primary ${styles.consultar}`} type="submit">
          <IconoBuscar tamano={18} /> Consultar
        </button>
        <p className={styles.pista}>Se usa la fecha de entrega del rescate.</p>
      </div>
      {error && (
        <p className={styles.errorCampo} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function ConsultaImpacto() {
  useSoloFundacion();
  const router = useRouter();
  const params = useSearchParams();
  const [porDefecto] = useState(periodoPorDefecto);
  const periodo = leerPeriodo(params) ?? porDefecto;
  const [intento, setIntento] = useState(0);
  const clave = `${periodo.desde}|${periodo.hasta}|${intento}`;
  const [resultado, setResultado] = useState<{ clave: string; resumen?: ImpactoResumen; error?: string } | null>(
    null,
  );

  useEffect(() => {
    const [desde, hasta] = clave.split("|");
    let vigente = true;
    impactoApi
      .resumen(desde, hasta)
      .then((resumen) => {
        if (vigente) setResultado({ clave, resumen });
      })
      .catch((reason) => {
        if (vigente) {
          setResultado({ clave, error: reason instanceof Error ? reason.message : "No se pudo consultar el impacto." });
        }
      });
    return () => {
      vigente = false;
    };
  }, [clave]);

  function consultar(nuevo: Periodo) {
    if (nuevo.desde === periodo.desde && nuevo.hasta === periodo.hasta) {
      setIntento((n) => n + 1);
      return;
    }
    router.replace(`/fundacion/impacto?${consultaPeriodo(nuevo)}`, { scroll: false });
  }

  const actual = resultado?.clave === clave ? resultado : null;
  const resumen = actual?.resumen ?? null;

  return (
    <main className={styles.pagina}>
      <header className={styles.encabezado}>
        <span className={styles.kicker}>Seguimiento de entregas</span>
        <h1>Impacto</h1>
        <p>Consulta el aporte de los rescates entregados en un periodo.</p>
      </header>

      <FormularioPeriodo key={`${periodo.desde}|${periodo.hasta}`} periodo={periodo} onConsultar={consultar} />

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
        <div className={`notice notice--error ${styles.aviso}`} role="alert">
          <span>{actual.error}</span>
          <button type="button" className="btn btn--secondary btn--compact" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}

      <section aria-labelledby="totales-titulo" aria-busy={!actual}>
        <h2 id="totales-titulo" className="sr-only">
          Totales del periodo
        </h2>
        <div className={styles.tarjetas}>
          {TOTALES.map((total) => {
            const Icono = total.icono;
            return (
              <article key={total.metrica} className={styles.tarjeta}>
                <div className={styles.tarjetaCabecera}>
                  <h3>{total.titulo}</h3>
                  <Icono tamano={20} className={styles.icono} />
                </div>
                <p className={styles.cifra}>
                  {resumen ? (
                    <>
                      <strong>{numero.format(total.valor(resumen))}</strong>
                      {total.unidad && <span> {total.unidad}</span>}
                    </>
                  ) : (
                    <span className={`skeleton ${styles.cifraCargando}`} aria-label="Cargando" />
                  )}
                </p>
                <p className={styles.ayuda}>{total.ayuda}</p>
                <Link
                  className={styles.verDetalle}
                  href={`/fundacion/impacto/detalle?${consultaPeriodo(periodo, total.metrica)}`}
                  aria-label={`Ver detalle de ${total.titulo.toLowerCase()}`}
                >
                  Ver detalle <IconoFlecha tamano={16} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {resumen && resumen.rescates_sin_kg > 0 && (
        <div className={`notice notice--warning ${styles.aviso}`} role="status">
          <IconoInfo tamano={18} />
          <span>
            <strong>
              {resumen.rescates_sin_kg === 1
                ? "1 rescate entregado tiene la cantidad estimada."
                : `${resumen.rescates_sin_kg} rescates entregados tienen la cantidad estimada.`}
            </strong>{" "}
            Su peso no se suma a los kilogramos porque no se pesó; se cuenta aparte.{" "}
            <Link href={`/fundacion/impacto/detalle?${consultaPeriodo(periodo, "sin_kg")}`}>Ver cuáles</Link>
          </span>
        </div>
      )}

      {resumen && (
        <section className={`panel ${styles.lectura}`} aria-labelledby="lectura-titulo">
          <h2 id="lectura-titulo">Cómo leer este impacto</h2>
          <dl>
            <dt>Personas beneficiadas = atenciones</dt>
            <dd>
              Suma de las atenciones que informa la receptora en cada entrega. Una persona puede contarse en varias
              entregas.
            </dd>
            <dt>Receptoras contadas una sola vez</dt>
            <dd>Si una organización recibe varias entregas en el periodo, cuenta una sola vez.</dd>
            <dt>Kilogramos medidos</dt>
            <dd>Solo suman las entregas pesadas. Las cantidades estimadas se cuentan aparte.</dd>
          </dl>
        </section>
      )}
    </main>
  );
}
