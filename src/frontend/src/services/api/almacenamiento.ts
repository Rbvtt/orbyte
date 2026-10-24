const CLAVE_TOKEN = "rescate.token";

/** Token JWT guardado por el inicio de sesión. Si no hay, la API responde 401. */
export function leerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}
