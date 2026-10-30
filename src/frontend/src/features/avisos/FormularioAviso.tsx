"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  IconoAlerta,
  IconoBalanza,
  IconoCalendario,
  IconoCheck,
  IconoCheckCirculo,
  IconoFlecha,
  IconoInfo,
  IconoMas,
  IconoReloj,
  IconoTienda,
  IconoTrigo,
  IconoUbicacion,
} from "@/components/ui/Iconos";
import { dia, fechaCorta, fechaLarga, hora24 } from "@/features/rescates/tiempo";
import { leerComercioId } from "@/services/api/sesion";
import type { RescateCreado } from "@/types/avisos";
import styles from "./FormularioAviso.module.css";
import { useRegistrarAviso } from "./useRegistrarAviso";
import {
  aLocalBogota,
  aPayload,
  FORMULARIO_VACIO,
  primerCampoConError,
  validarAviso,
  type CampoAviso,
  type ErroresAviso,
  type FormularioAviso as Formulario,
} from "./validacion";

type Icono = (p: { className?: string; tamano?: number }) => React.ReactNode;

/**
 * CMP-01 · Aviso de donación (#8), según el prototipo móvil de 360 px (#7).
 * Envía a POST /api/v1/rescates (#6): datos completos → confirmación con el id y el estado
 * «disponible» (CA-01.1); dato faltante → no se envía y se señala el campo (CA-01.2).
 */
export function FormularioAviso() {
  const { estado, enviar, reiniciar, fallar } = useRegistrarAviso();
  const [form, setForm] = useState<Formulario>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<ErroresAviso>({});
  const [intentado, setIntentado] = useState(false);
  const refs = useRef<Partial<Record<CampoAviso, HTMLElement | null>>>({});
  const ahora = new Date();

  function cambiar(campo: CampoAviso, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  function enfocarPrimero(encontrados: ErroresAviso) {
    const primero = primerCampoConError(encontrados);
    if (primero) refs.current[primero]?.focus();
  }

  async function alEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setIntentado(true);
    const encontrados = validarAviso(form, new Date());
    setErrores(encontrados);
    if (primerCampoConError(encontrados)) {
      enfocarPrimero(encontrados);
      return;
    }
    const comercioId = leerComercioId();
    if (!comercioId) {
      // TODO(#40): cuando la API exponga el comercio del usuario, este caso solo pasa sin sesión.
      fallar("No encontramos el comercio de tu usuario. Vuelve a iniciar sesión.");
      return;
    }
    const resultado = await enviar(aPayload(form, comercioId));
    if (resultado.tipo === "fallo") {
      setErrores(resultado.errores);
      enfocarPrimero(resultado.errores);
    }
  }

  if (estado.tipo === "exito") {
    return (
      <Confirmacion
        rescate={estado.rescate}
        comercio={form.comercio.trim()}
        otro={() => {
          setForm(FORMULARIO_VACIO);
          setErrores({});
          setIntentado(false);
          reiniciar();
        }}
      />
    );
  }

  const enviando = estado.tipo === "enviando";
  const pendientes = Object.values(errores).filter(Boolean).length;
  const completo = !primerCampoConError(validarAviso(form, ahora));

  let aviso: { tipo: "error" | "info"; titulo: string; texto: string };
  if (estado.tipo === "error" && estado.mensaje) {
    aviso = { tipo: "error", titulo: "El aviso no se ha guardado.", texto: estado.mensaje };
  } else if (intentado && pendientes > 0) {
    aviso = {
      tipo: "error",
      titulo: "El aviso no se ha guardado.",
      texto: pendientes === 1 ? "Completa el campo señalado." : `Completa los ${pendientes} campos señalados.`,
    };
  } else if (completo) {
    aviso = { tipo: "info", titulo: "Todo listo para registrar.", texto: "Aún no se ha guardado el aviso." };
  } else {
    aviso = { tipo: "info", titulo: "Todos los campos son obligatorios.", texto: "Solo necesitamos estos 5 datos." };
  }

  const ref = (campo: CampoAviso) => (el: HTMLElement | null) => {
    refs.current[campo] = el;
  };

  return (
    <div className={styles.aviso}>
      <h1 className={styles.titulo}>Aviso de donación</h1>
      <p className={styles.lema}>Lo que te sobra puede hacer mucho.</p>
      <p className={styles.hoy}>
        <IconoCalendario tamano={16} />
        Hoy · {fechaLarga(ahora)}
      </p>

      <div className={`${styles.banner} ${aviso.tipo === "error" ? styles.bannerError : ""}`} role={aviso.tipo === "error" ? "alert" : "status"}>
        {aviso.tipo === "error" ? <IconoAlerta tamano={18} /> : <IconoInfo tamano={18} />}
        <div>
          <p className={styles.bannerTitulo}>{aviso.titulo}</p>
          <p>{aviso.texto}</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={alEnviar} noValidate>
        <Campo etiqueta="Comercio" ayuda="El nombre de tu establecimiento." error={errores.comercio} icono={IconoTienda}>
          {(props) => (
            <input
              {...props}
              ref={ref("comercio")}
              type="text"
              autoComplete="organization"
              placeholder="Nombre del comercio"
              value={form.comercio}
              onChange={(e) => cambiar("comercio", e.target.value)}
            />
          )}
        </Campo>

        <Campo etiqueta="Alimento" ayuda="Describe brevemente lo que donas." error={errores.alimento} icono={IconoTrigo}>
          {(props) => (
            <input
              {...props}
              ref={ref("alimento")}
              type="text"
              autoComplete="off"
              placeholder="¿Qué alimento vas a donar?"
              value={form.alimento}
              onChange={(e) => cambiar("alimento", e.target.value)}
            />
          )}
        </Campo>

        <Campo etiqueta="Cantidad aproximada" ayuda="Una estimación es suficiente." error={errores.cantidad_aprox} icono={IconoBalanza}>
          {(props) => (
            <input
              {...props}
              ref={ref("cantidad_aprox")}
              type="text"
              autoComplete="off"
              placeholder="Ej. 8 kg o 12 raciones"
              value={form.cantidad_aprox}
              onChange={(e) => cambiar("cantidad_aprox", e.target.value)}
            />
          )}
        </Campo>

        <Campo etiqueta="Lugar de recogida" ayuda="Incluye calle, número y localidad." error={errores.lugar_recogida} icono={IconoUbicacion}>
          {(props) => (
            <input
              {...props}
              ref={ref("lugar_recogida")}
              type="text"
              autoComplete="street-address"
              placeholder="Dirección de recogida"
              value={form.lugar_recogida}
              onChange={(e) => cambiar("lugar_recogida", e.target.value)}
            />
          )}
        </Campo>

        <Campo
          etiqueta="Hora límite"
          ayuda="Fecha y hora de recogida, en hora de Colombia."
          error={errores.hora_limite}
          icono={IconoReloj}
        >
          {(props) => (
            <input
              {...props}
              ref={ref("hora_limite")}
              type="datetime-local"
              min={aLocalBogota(ahora)}
              value={form.hora_limite}
              onChange={(e) => cambiar("hora_limite", e.target.value)}
            />
          )}
        </Campo>

        <Campo etiqueta="Observaciones" opcional error={errores.observaciones}>
          {(props) => (
            <textarea
              {...props}
              ref={ref("observaciones")}
              rows={3}
              placeholder="Por ejemplo: preguntar por Rosa en caja."
              value={form.observaciones}
              onChange={(e) => cambiar("observaciones", e.target.value)}
            />
          )}
        </Campo>

        <div className={styles.pie}>
          <button type="submit" className={styles.boton} disabled={enviando} aria-busy={enviando}>
            {enviando ? "Registrando…" : "Registrar aviso"}
            {!enviando && <IconoFlecha tamano={18} />}
          </button>
          <p className={styles.nota}>Al registrar, el rescate quedará disponible.</p>
        </div>
      </form>
    </div>
  );
}

type PropsControl = {
  id: string;
  className: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
};

/** Etiqueta arriba, ícono a la derecha, ayuda debajo y el error junto al campo (#7). */
function Campo({
  etiqueta,
  ayuda,
  error,
  icono: Icono,
  opcional = false,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  icono?: Icono;
  opcional?: boolean;
  children: (props: PropsControl) => React.ReactNode;
}) {
  const id = useId();
  const describe = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
  return (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.etiqueta}>
        {etiqueta} {opcional ? <span className={styles.opcional}>(opcional)</span> : <span aria-hidden="true">*</span>}
      </label>
      <div className={`${styles.control} ${error ? styles.conError : ""}`}>
        {children({
          id,
          className: Icono ? `${styles.entrada} ${styles.conIcono}` : styles.entrada,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describe,
          "aria-required": opcional ? undefined : true,
        })}
        {error ? <IconoAlerta className={styles.iconoCampo} /> : Icono ? <Icono className={styles.iconoCampo} /> : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className={styles.ayuda}>
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

const FILAS: { etiqueta: string; icono: Icono; valor: (r: RescateCreado, comercio: string) => string }[] = [
  { etiqueta: "Comercio", icono: IconoTienda, valor: (_, comercio) => comercio },
  { etiqueta: "Alimento", icono: IconoTrigo, valor: (r) => r.alimento },
  { etiqueta: "Cantidad aproximada", icono: IconoBalanza, valor: (r) => r.cantidad_aprox },
  { etiqueta: "Lugar de recogida", icono: IconoUbicacion, valor: (r) => r.lugar_recogida },
  {
    etiqueta: "Hora límite de recogida",
    icono: IconoReloj,
    valor: (r) => {
      const limite = new Date(r.hora_limite);
      const cuando = dia(r.hora_limite);
      return `${cuando.charAt(0).toUpperCase()}${cuando.slice(1)}, ${fechaCorta(limite)} · ${hora24(limite)} h`;
    },
  },
];

/** CA-01.1: confirmación con el id del aviso y el estado «disponible» (#7). */
function Confirmacion({ rescate, comercio, otro }: { rescate: RescateCreado; comercio: string; otro: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);
  const registro = new Date(rescate.creado_en);

  return (
    <section className={`${styles.aviso} ${styles.exito}`} aria-labelledby="exito-titulo">
      <span className={styles.check}>
        <IconoCheck tamano={28} />
      </span>
      <h1 id="exito-titulo" ref={titulo} tabIndex={-1} className={styles.exitoTitulo}>
        ¡Aviso registrado!
      </h1>
      <p className={styles.exitoTexto}>Tu donación se ha guardado y ya está disponible para el rescate.</p>
      <span className={styles.estado}>
        <IconoCheckCirculo tamano={16} />
        {rescate.estado === "disponible" ? "Disponible" : rescate.estado}
      </span>
      <p className={styles.codigo}>
        Id del aviso <span className="num">{rescate.id}</span>
      </p>

      <div className={styles.resumen}>
        <h2 className={styles.resumenTitulo}>Resumen de la donación</h2>
        <dl>
          {FILAS.map(({ etiqueta, icono: Icono, valor }) => (
            <div key={etiqueta} className={styles.fila}>
              <Icono className={styles.filaIcono} />
              <dt>{etiqueta}</dt>
              <dd>{valor(rescate, comercio)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={styles.registro}>
        <IconoCalendario className={styles.filaIcono} />
        <p>
          Fecha y hora de registro
          <strong>
            {fechaCorta(registro)} · {hora24(registro)} h (hora local)
          </strong>
        </p>
      </div>

      <p className={styles.gracias}>Gracias por alimentar a tu comunidad.</p>
      <button type="button" className={styles.boton} onClick={otro}>
        Crear otro aviso
        <IconoMas tamano={18} />
      </button>
    </section>
  );
}
