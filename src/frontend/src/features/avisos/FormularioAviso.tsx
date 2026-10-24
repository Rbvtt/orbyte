"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/Field";
import { dia, hora } from "@/features/rescates/tiempo";
import type { RescateDetalle } from "@/types/api";
import styles from "./FormularioAviso.module.css";
import { useRegistrarAviso } from "./useRegistrarAviso";
import {
  aPayload,
  enHoras,
  FORMULARIO_VACIO,
  primerCampoConError,
  validarAviso,
  type CampoAviso,
  type ErroresAviso,
  type FormularioAviso as Formulario,
} from "./validacion";

const ATAJOS_HORA = [1, 2, 3, 4];

/**
 * CMP-01 · Aviso de alimento disponible (#7, #8).
 * Solo los cinco datos mínimos y observaciones opcionales (RNF-001), en el lenguaje del
 * comerciante (RNF-002), pensado para un teléfono de 360 px (RNF-004).
 */
export function FormularioAviso() {
  const { estado, enviar, reiniciar } = useRegistrarAviso();

  const [form, setForm] = useState<Formulario>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<ErroresAviso>({});
  const [atajo, setAtajo] = useState<number | null>(null);
  const refs = useRef<Partial<Record<CampoAviso, HTMLElement | null>>>({});

  // Errores que devuelve el servidor (422) se suman a los del formulario.
  const erroresVisibles: ErroresAviso = estado.tipo === "error" ? { ...estado.errores, ...errores } : errores;

  function cambiar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo as CampoAviso]) setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function alEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    const encontrados = validarAviso(form);
    setErrores(encontrados);
    const primero = primerCampoConError(encontrados);
    if (primero) {
      refs.current[primero]?.focus();
      return;
    }
    const creado = await enviar(aPayload(form));
    if (!creado) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (estado.tipo === "exito") {
    return (
      <Confirmacion
        rescate={estado.rescate}
        otro={() => {
          setForm(FORMULARIO_VACIO);
          setErrores({});
          setAtajo(null);
          reiniciar();
        }}
      />
    );
  }

  const enviando = estado.tipo === "enviando";

  return (
    <form className="form" onSubmit={alEnviar} noValidate aria-describedby="aviso-ayuda">
      <p id="aviso-ayuda" className={styles.intro}>
        Cuéntanos qué tienes para donar. La fundación asigna un voluntario que pasa a recogerlo.
      </p>

      {estado.tipo === "error" && (
        <div className="notice notice--error" role="alert">
          <p>{estado.mensaje}</p>
        </div>
      )}

      <Field etiqueta="¿Qué alimento es?" ayuda="Por ejemplo: pan del día, tomate, yogur." error={erroresVisibles.alimento}>
        <input
          className="input"
          type="text"
          autoComplete="off"
          maxLength={200}
          value={form.alimento}
          onChange={(e) => cambiar("alimento", e.target.value)}
          ref={(el) => {
            refs.current.alimento = el;
          }}
        />
      </Field>

      <Field etiqueta="¿Cuánto hay, más o menos?" ayuda="Como lo cuentes: 2 canastas, 3 cajas, unos 15 kg." error={erroresVisibles.cantidad_aprox}>
        <input
          className="input"
          type="text"
          autoComplete="off"
          maxLength={60}
          value={form.cantidad_aprox}
          onChange={(e) => cambiar("cantidad_aprox", e.target.value)}
          ref={(el) => {
            refs.current.cantidad_aprox = el;
          }}
        />
      </Field>

      <Field etiqueta="¿Dónde se recoge?" ayuda="Dirección o una referencia fácil de encontrar." error={erroresVisibles.lugar_recogida}>
        <input
          className="input"
          type="text"
          autoComplete="street-address"
          maxLength={200}
          value={form.lugar_recogida}
          onChange={(e) => cambiar("lugar_recogida", e.target.value)}
          ref={(el) => {
            refs.current.lugar_recogida = el;
          }}
        />
      </Field>

      <Field etiqueta="¿Hasta qué hora se puede recoger?" error={erroresVisibles.hora_limite}>
        <div className={styles.horaGrupo}>
          <div className="chips" role="group" aria-label="Atajos de hora">
            {ATAJOS_HORA.map((h) => (
              <button
                key={h}
                type="button"
                className="chip-btn"
                aria-pressed={atajo === h}
                onClick={() => {
                  setAtajo(h);
                  cambiar("hora_limite", enHoras(h));
                }}
              >
                En {h} {h === 1 ? "hora" : "horas"}
              </button>
            ))}
          </div>
          <input
            className="input"
            type="datetime-local"
            value={form.hora_limite}
            onChange={(e) => {
              setAtajo(null);
              cambiar("hora_limite", e.target.value);
            }}
            ref={(el) => {
              refs.current.hora_limite = el;
            }}
            aria-label="Fecha y hora límite"
          />
        </div>
      </Field>

      <Field etiqueta="Algo más que debamos saber" opcional ayuda="Por ejemplo: necesita nevera, preguntar por Rosa." error={erroresVisibles.observaciones}>
        <textarea
          className="textarea"
          maxLength={500}
          value={form.observaciones}
          onChange={(e) => cambiar("observaciones", e.target.value)}
          ref={(el) => {
            refs.current.observaciones = el;
          }}
        />
      </Field>

      <button type="submit" className="btn btn--primary btn--block" disabled={enviando} aria-busy={enviando}>
        {enviando ? "Enviando…" : "Enviar aviso"}
      </button>
    </form>
  );
}

function Confirmacion({ rescate, otro }: { rescate: RescateDetalle; otro: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);

  return (
    <section className={styles.exito} aria-labelledby="exito-titulo">
      <h2 id="exito-titulo" ref={titulo} tabIndex={-1} className={styles.exitoTitulo}>
        Aviso enviado
      </h2>
      <p className={styles.numero}>
        Rescate <span className="num">n.º {rescate.numero}</span>
      </p>
      {/* CA-01.1: el aviso queda en estado «disponible». */}
      <span className={`pill pill--${rescate.estado}`}>Estado: {rescate.estado}</span>
      <dl className={styles.resumen}>
        <div>
          <dt>Alimento</dt>
          <dd>
            {rescate.alimento} · {rescate.cantidad_aprox}
          </dd>
        </div>
        <div>
          <dt>Comercio</dt>
          <dd>{rescate.comercio_nombre}</dd>
        </div>
        <div>
          <dt>Recoger hasta</dt>
          <dd className="num">
            {dia(rescate.hora_limite)}, {hora(rescate.hora_limite)}
          </dd>
        </div>
      </dl>
      <p className={styles.siguiente}>
        La fundación ya lo ve. Si necesitas cambiar algo, llama a la fundación y dales este número.
      </p>
      <div className={styles.acciones}>
        <button type="button" className="btn btn--primary" onClick={otro}>
          Registrar otro aviso
        </button>
      </div>
    </section>
  );
}
