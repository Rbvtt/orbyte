export class ApiError extends Error {
  constructor(status, message, cuerpo) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    // Cuerpo JSON de la respuesta. En 422 el backend devuelve [{ campo, mensaje }].
    this.cuerpo = cuerpo;
  }
}

async function request(url, { method = "GET", token, body, headers = {}, signal } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError(0, "No hay conexión con el servidor. Inténtalo de nuevo.");
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    const detail = datos?.detail;
    const mensaje =
      typeof detail === "string" ? detail : "No se pudo completar la operación.";
    throw new ApiError(respuesta.status, mensaje, datos);
  }
  return datos;
}

/** GET /api/v1/auth/me -> { id, nombre, rol } del usuario del JWT. */
export function obtenerUsuarioActual({ baseUrl = "", token, signal }) {
  return request(`${baseUrl}/api/v1/auth/me`, { token, signal });
}

export function listarComercios({ baseUrl = "", token, signal }) {
  return request(`${baseUrl}/api/v1/comercios`, { token, signal });
}

/**
 * POST /api/v1/rescates
 * El payload NO incluye registrado_por ni estado: los fija el backend
 * (registrado_por sale del JWT, estado = disponible).
 */
export function crearRescate({ baseUrl = "", token, payload, idempotencyKey }) {
  return request(`${baseUrl}/api/v1/rescates`, {
    method: "POST",
    token,
    body: payload,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
  });
}

const ES_MENSAJE_DE_VACIO = /obligatorio|no puede estar vac/i;

/**
 * El backend (main.py + FieldValidationError) responde los 422 como
 * [{ "campo": "alimento", "mensaje": "El campo alimento es obligatorio" }].
 *
 * - Si el error es "campo vacío/obligatorio" se muestra el texto del diseño (Figma).
 * - Cualquier otro mensaje (p. ej. "El comercio indicado no existe") se muestra tal cual.
 * - Los errores de campos que no están en el formulario (p. ej. Idempotency-Key)
 *   se devuelven en `generales`.
 */
export function mapearErrores422(cuerpo, mensajesPorCampo, camposConocidos) {
  const porCampo = {};
  const generales = [];
  if (!Array.isArray(cuerpo)) {
    return { porCampo, generales: ["Datos no válidos."] };
  }
  for (const item of cuerpo) {
    const campo = item?.campo;
    const mensaje = item?.mensaje ?? "Datos no válidos.";
    if (camposConocidos.includes(campo)) {
      porCampo[campo] =
        ES_MENSAJE_DE_VACIO.test(mensaje) && mensajesPorCampo[campo]
          ? mensajesPorCampo[campo]
          : mensaje;
    } else {
      generales.push(mensaje);
    }
  }
  return { porCampo, generales };
}
