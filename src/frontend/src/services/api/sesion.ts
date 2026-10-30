/**
 * Sesión guardada en el navegador.
 *
 * El inicio de sesión de la pantalla (#40) guarda aquí el token que devuelve
 * POST /api/v1/auth/login. Mientras esa pantalla no exista, para probar se guarda a mano
 * (ver README · Frontend).
 */

const CLAVE_TOKEN = "rescate.token";
const CLAVE_COMERCIO = "rescate.comercio_id";

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

/**
 * Comercio del usuario que avisa (POST /api/v1/rescates exige `comercio_id`).
 * TODO(#40): la API todavía no expone el comercio del usuario (ni en el token ni en un
 * endpoint). Cuando lo haga, tomarlo de ahí en vez de esta clave del navegador.
 */
export function leerComercioId(): string | null {
  return leer(CLAVE_COMERCIO);
}
