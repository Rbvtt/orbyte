/**
 * Tipos comunes de la API (src/backend/app). Los de cada pantalla están en su propio archivo:
 * avisos.ts (#6), rescates.ts (#37) y asignacion.ts (#10).
 */

export type EstadoRescate = "disponible" | "asignado" | "recogido" | "entregado" | "no_completado";

/** Los 422 de validación llegan como lista: `[{"campo": "...", "mensaje": "..."}]` (app/main.py). */
export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

export type RolUsuario = "fundacion" | "comercio" | "voluntario" | "organizacion";

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  comercio_id: string | null;
  comercio_nombre: string | null;
}

export interface Comercio {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
}
