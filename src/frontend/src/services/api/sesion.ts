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

/** Rol para presentar acciones en la interfaz; la API vuelve a validar permisos en cada petición. */
export function leerRolToken(): string | null {
  const token = leerToken();
  if (!token) return null;
  try {
    const segmento = token.split(".")[1];
    if (!segmento) return null;
    const base64 = segmento.replace(/-/g, "+").replace(/_/g, "/");
    const completo = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(window.atob(completo)) as { rol?: unknown };
    return typeof payload.rol === "string" ? payload.rol : null;
  } catch {
    return null;
  }
}

/**
 * Comercio del usuario que avisa (POST /api/v1/rescates exige `comercio_id`).
 * TODO(#40): la API todavía no expone el comercio del usuario (ni en el token ni en un
 * endpoint). Cuando lo haga, tomarlo de ahí en vez de esta clave del navegador.
 */
export function leerComercioId(): string | null {
  return leer(CLAVE_COMERCIO);
}
