/**
 * Lógica del formulario de aviso (#8), sin React. Cinco datos obligatorios con los mensajes
 * del prototipo de #7. La hora límite se escribe en un `datetime-local` y se envía en ISO 8601
 * con la zona de Bogotá (America/Bogota): Colombia no cambia de horario, siempre es UTC-5.
 */

import type { ErrorCampo } from "@/types/api";
import type { RescateCrear } from "@/types/avisos";

const DESFASE_BOGOTA = "-05:00";

export type CampoAviso = "comercio" | "alimento" | "cantidad_aprox" | "lugar_recogida" | "hora_limite" | "observaciones";

export type FormularioAviso = {
  comercio: string;
  alimento: string;
  cantidad_aprox: string;
  lugar_recogida: string;
  /** Valor de un <input type="datetime-local">: "2026-10-30T18:00", hora de Bogotá. */
  hora_limite: string;
  observaciones: string;
};

export type ErroresAviso = Partial<Record<CampoAviso, string>>;

export const FORMULARIO_VACIO: FormularioAviso = {
  comercio: "",
  alimento: "",
  cantidad_aprox: "",
  lugar_recogida: "",
  hora_limite: "",
  observaciones: "",
};

/** Orden en pantalla: el foco va al primer campo con error. */
const ORDEN_CAMPOS: CampoAviso[] = ["comercio", "alimento", "cantidad_aprox", "lugar_recogida", "hora_limite", "observaciones"];

/** Mensajes del prototipo (#7). */
const MENSAJES_FALTANTE: Record<Exclude<CampoAviso, "observaciones">, string> = {
  comercio: "Indica el nombre del comercio.",
  alimento: "Indica qué alimento vas a donar.",
  cantidad_aprox: "Indica una cantidad aproximada.",
  lugar_recogida: "Indica el lugar de recogida.",
  hora_limite: "Indica la fecha y hora límite.",
};

/** Campos de la API que corresponden a otro nombre en el formulario. */
const CAMPO_DESDE_API: Record<string, CampoAviso> = { comercio_id: "comercio" };

const FORMATO_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const MS_BOGOTA = -5 * 60 * 60 * 1000;

/** "2026-10-30T18:00" (datetime-local, hora de Bogotá) → "2026-10-30T18:00:00-05:00". */
function aIsoBogota(local: string): string {
  return `${local.slice(0, 16)}:00${DESFASE_BOGOTA}`;
}

/** Fecha absoluta → valor de datetime-local en hora de Bogotá ("2026-10-30T18:00"). */
export function aLocalBogota(fecha: Date): string {
  return new Date(fecha.getTime() + MS_BOGOTA).toISOString().slice(0, 16);
}

export function validarAviso(
  form: FormularioAviso,
  ahora: Date = new Date(),
  requiereComercio = true,
): ErroresAviso {
  const errores: ErroresAviso = {};
  if (requiereComercio && !form.comercio.trim()) {
    errores.comercio = MENSAJES_FALTANTE.comercio;
  }
  for (const campo of ["alimento", "cantidad_aprox", "lugar_recogida"] as const) {
    if (!form[campo].trim()) errores[campo] = MENSAJES_FALTANTE[campo];
  }
  if (!form.hora_limite) {
    errores.hora_limite = MENSAJES_FALTANTE.hora_limite;
  } else if (!FORMATO_LOCAL.test(form.hora_limite) || Number.isNaN(new Date(aIsoBogota(form.hora_limite)).getTime())) {
    errores.hora_limite = "Escribe una fecha y hora válidas.";
  } else if (new Date(aIsoBogota(form.hora_limite)).getTime() <= ahora.getTime()) {
    errores.hora_limite = "Esa hora ya pasó. Indica una hora posterior a la actual.";
  }
  return errores;
}

/** 422 del backend → error junto a cada campo (CA-01.2). Lo que no es de un campo va aparte. */
export function erroresDesdeApi(errores: ErrorCampo[]): { porCampo: ErroresAviso; generales: string[] } {
  const porCampo: ErroresAviso = {};
  const generales: string[] = [];
  for (const { campo, mensaje } of errores) {
    const propio = CAMPO_DESDE_API[campo] ?? campo;
    if ((ORDEN_CAMPOS as string[]).includes(propio)) {
      porCampo[propio as CampoAviso] ??= mensaje;
    } else {
      generales.push(mensaje);
    }
  }
  return { porCampo, generales };
}

export function primerCampoConError(errores: ErroresAviso): CampoAviso | undefined {
  return ORDEN_CAMPOS.find((c) => errores[c]);
}

export function aPayload(form: FormularioAviso, comercioId: string): RescateCrear {
  return {
    comercio_id: comercioId,
    alimento: form.alimento.trim(),
    cantidad_aprox: form.cantidad_aprox.trim(),
    lugar_recogida: form.lugar_recogida.trim(),
    hora_limite: aIsoBogota(form.hora_limite),
    observaciones: form.observaciones.trim() || null,
  };
}
