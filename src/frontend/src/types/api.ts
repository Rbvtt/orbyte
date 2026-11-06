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

export type RolUsuario = "administrador" | "fundacion" | "comercio" | "voluntario" | "organizacion";

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  comercio_id: string | null;
  comercio_nombre: string | null;
  estado?: "pendiente" | "aprobado" | "rechazado" | "inactivo";
}

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  estado: "pendiente" | "aprobado" | "rechazado" | "inactivo";
  activo: boolean;
  comercio_id: string | null;
  organizacion_id: string | null;
  motivo_rechazo: string | null;
}

export interface ComercioGestion {
  id: string;
  nombre: string;
  email: string;
  estado: "pendiente" | "aprobado" | "rechazado" | "inactivo";
  activo: boolean;
  direccion: string;
  telefono: string | null;
  motivo_rechazo: string | null;
}

export interface Comercio {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
}

export interface OrganizacionReceptora {
  id: string;
  nombre: string;
  capacidad_kg: number | null;
  refrigeracion: boolean;
  horario_recepcion: string | null;
}

export interface Voluntario {
  id: string;
  nombre: string;
  medio_transporte: string | null;
  disponibilidad: string | null;
}
