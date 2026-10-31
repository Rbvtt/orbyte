/**
 * Sesión guardada en el navegador.
 *
 * El inicio de sesión de la pantalla (#40) guarda aquí el token que devuelve
 * POST /api/v1/auth/login. Mientras esa pantalla no exista, para probar se guarda a mano
 * (ver README · Frontend).
 */

const CLAVE_TOKEN = "rescate.token";
const CLAVE_COMERCIO = "rescate.comercio_id";
const EVENTO_SESION = "rescate:sesion-cambiada";

function leer(clave: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
}

/** Token JWT. Si no hay, la API responde 401. */
export function leerToken(): string | null {
  return leer(CLAVE_TOKEN);
}

export function guardarToken(token: string): void {
  window.localStorage.setItem(CLAVE_TOKEN, token);
  window.dispatchEvent(new Event(EVENTO_SESION));
}

export function cerrarSesion(): void {
  window.localStorage.removeItem(CLAVE_TOKEN);
  window.localStorage.removeItem(CLAVE_COMERCIO);
  window.dispatchEvent(new Event(EVENTO_SESION));
}

export function suscribirSesion(cambio: () => void): () => void {
  window.addEventListener(EVENTO_SESION, cambio);
  window.addEventListener("storage", cambio);
  return () => {
    window.removeEventListener(EVENTO_SESION, cambio);
    window.removeEventListener("storage", cambio);
  };
}

/** Compatibilidad con sesiones antiguas; el formulario usa ahora `/api/v1/auth/me`. */
export function leerComercioId(): string | null {
  return leer(CLAVE_COMERCIO);
}
