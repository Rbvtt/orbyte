/**
 * Capa de datos: el único lugar que habla HTTP con el backend.
 * Los componentes nunca llaman a fetch directamente; pasan por los hooks de features/.
 */

import type { ErrorCampo } from "@/types/api";
import { leerToken } from "./sesion";

/** VITE_API_URL del .env de la raíz del repositorio (lo inyecta next.config.ts). */
export const API_URL = (process.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
    readonly cuerpo: unknown,
  ) {
    super(mensaje);
    this.name = "ApiError";
  }

  /** Errores por campo de un 422: la API los devuelve como lista `[{campo, mensaje}]`. */
  get erroresPorCampo(): ErrorCampo[] {
    return Array.isArray(this.cuerpo) ? (this.cuerpo as ErrorCampo[]) : [];
  }
}

export class SinConexion extends Error {
  constructor() {
    super("No hay conexión con el servidor. Revisa tus datos o wifi e inténtalo de nuevo.");
    this.name = "SinConexion";
  }
}

type Opciones = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function mensajeDe(status: number, cuerpo: unknown): string {
  // 401: la API responde «No autorizado»; a la persona le sirve más saber qué hacer.
  if (status === 401) return "Tu sesión terminó. Vuelve a iniciar sesión.";
  if (status === 422) return "Revisa los datos marcados.";
  const detalle = (cuerpo as { detail?: unknown } | null)?.detail;
  if (typeof detalle === "string") return detalle;
  if (status === 403) return "No tienes permiso para esta acción.";
  if (status >= 500) return "El servidor tuvo un problema. Inténtalo de nuevo en un momento.";
  return "No se pudo completar la acción.";
}

export async function apiFetch<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { method = "GET", body, headers = {}, signal } = opciones;
  const finales: Record<string, string> = { Accept: "application/json", ...headers };
  if (body !== undefined) finales["Content-Type"] = "application/json";
  const token = leerToken();
  if (token) finales.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method,
      headers: finales,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new SinConexion();
  }

  const texto = await respuesta.text();
  const cuerpo = texto ? (JSON.parse(texto) as unknown) : null;
  if (!respuesta.ok) {
    throw new ApiError(respuesta.status, mensajeDe(respuesta.status, cuerpo), cuerpo);
  }
  return cuerpo as T;
}
