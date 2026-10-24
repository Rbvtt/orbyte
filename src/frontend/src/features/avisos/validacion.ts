/**
 * Lógica del formulario de aviso (#8), sin React: se prueba en tests/frontend.
 *
 * Colombia no cambia de horario: la hora local de Bogotá es siempre UTC-5.
 */

import type { ErrorCampo, RescateCrear } from "@/types/api";

export const DESFASE_BOGOTA = "-05:00";
const MS_BOGOTA = -5 * 60 * 60 * 1000;

export type CampoAviso = "alimento" | "cantidad_aprox" | "lugar_recogida" | "hora_limite" | "observaciones";

export type FormularioAviso = {
  alimento: string;
  cantidad_aprox: string;
  lugar_recogida: string;
  /** Valor de un <input type="datetime-local">: "2026-10-23T18:30" en hora de Bogotá. */
  hora_limite: string;
  observaciones: string;
};

export type ErroresAviso = Partial<Record<CampoAviso, string>>;

export const FORMULARIO_VACIO: FormularioAviso = {
  alimento: "",
  cantidad_aprox: "",
  lugar_recogida: "",
  hora_limite: "",
  observaciones: "",
};

/** Orden en que aparecen en pantalla: el foco va al primer campo con error. */
export const ORDEN_CAMPOS: CampoAviso[] = ["alimento", "cantidad_aprox", "lugar_recogida", "hora_limite", "observaciones"];

const MENSAJES_FALTANTE: Record<Exclude<CampoAviso, "observaciones">, string> = {
  alimento: "Escribe qué alimento vas a donar.",
  cantidad_aprox: "Escribe cuánto hay, aunque sea aproximado.",
  lugar_recogida: "Escribe dónde se recoge.",
  hora_limite: "Indica hasta qué hora se puede recoger.",
};

/** "2026-10-23T18:30" (hora de Bogotá) → "2026-10-23T18:30:00-05:00". */
export function aIsoBogota(local: string): string {
  const [fecha, hora = ""] = local.split("T");
  const [hh = "00", mm = "00"] = hora.split(":");
  return `${fecha}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00${DESFASE_BOGOTA}`;
}

/** Fecha absoluta → valor de datetime-local en hora de Bogotá ("2026-10-23T18:30"). */
export function aLocalBogota(fecha: Date): string {
  const b = new Date(fecha.getTime() + MS_BOGOTA);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${b.getUTCFullYear()}-${dos(b.getUTCMonth() + 1)}-${dos(b.getUTCDate())}T${dos(b.getUTCHours())}:${dos(b.getUTCMinutes())}`;
}

/** Atajo «en N horas», redondeado al minuto. */
export function enHoras(horas: number, ahora: Date = new Date()): string {
  const base = new Date(ahora.getTime());
  base.setUTCSeconds(0, 0);
  return aLocalBogota(new Date(base.getTime() + horas * 60 * 60 * 1000));
}

export function validarAviso(form: FormularioAviso, opciones: { ahora?: Date } = {}): ErroresAviso {
  const errores: ErroresAviso = {};
  const ahora = opciones.ahora ?? new Date();

  if (!form.alimento.trim()) errores.alimento = MENSAJES_FALTANTE.alimento;
  if (!form.cantidad_aprox.trim()) errores.cantidad_aprox = MENSAJES_FALTANTE.cantidad_aprox;
  else if (form.cantidad_aprox.trim().length > 60) errores.cantidad_aprox = "Escríbelo en menos palabras (máximo 60 letras).";
  if (!form.lugar_recogida.trim()) errores.lugar_recogida = MENSAJES_FALTANTE.lugar_recogida;

  if (!form.hora_limite) {
    errores.hora_limite = MENSAJES_FALTANTE.hora_limite;
  } else {
    const limite = new Date(aIsoBogota(form.hora_limite));
    if (Number.isNaN(limite.getTime())) errores.hora_limite = "Escribe una fecha y hora válidas.";
    else if (limite.getTime() <= ahora.getTime()) errores.hora_limite = "Esa hora ya pasó. Indica una hora posterior a la actual.";
  }

  if (form.observaciones.length > 500) errores.observaciones = "Máximo 500 letras.";
  return errores;
}

/** 422 del backend → error junto a cada campo (CA-01.2). */
export function erroresDesdeApi(errores: ErrorCampo[]): ErroresAviso {
  const resultado: ErroresAviso = {};
  for (const { campo, mensaje } of errores) {
    if ((ORDEN_CAMPOS as string[]).includes(campo) && !resultado[campo as CampoAviso]) {
      resultado[campo as CampoAviso] = mensaje;
    }
  }
  return resultado;
}

export function primerCampoConError(errores: ErroresAviso): CampoAviso | undefined {
  return ORDEN_CAMPOS.find((c) => errores[c]);
}

export function aPayload(form: FormularioAviso): RescateCrear {
  const payload: RescateCrear = {
    alimento: form.alimento.trim(),
    cantidad_aprox: form.cantidad_aprox.trim(),
    lugar_recogida: form.lugar_recogida.trim(),
    hora_limite: aIsoBogota(form.hora_limite),
  };
  if (form.observaciones.trim()) payload.observaciones = form.observaciones.trim();
  return payload;
}
