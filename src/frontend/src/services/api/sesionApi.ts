import type {
  Comercio,
  ComercioGestion,
  OrganizacionReceptora,
  RolUsuario,
  UsuarioAdmin,
  UsuarioSesion,
  Voluntario,
} from "@/types/api";
import { apiFetch } from "./client";
import { guardarToken } from "./sesion";

type LoginRespuesta = { access_token: string; token_type: string };

type RegistroDatos = {
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
  direccion?: string;
  telefono?: string;
  medio_transporte?: string;
  disponibilidad?: string;
};

export const sesionApi = {
  login: async (email: string, password: string): Promise<UsuarioSesion> => {
    const token = await apiFetch<LoginRespuesta>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    guardarToken(token.access_token);
    return apiFetch<UsuarioSesion>("/api/v1/auth/me");
  },
  register: (datos: RegistroDatos) =>
    apiFetch<{ mensaje: string; aprobado: boolean }>("/api/v1/auth/register", {
      method: "POST",
      body: datos,
    }),
  me: () => apiFetch<UsuarioSesion>("/api/v1/auth/me"),
  comercios: () => apiFetch<Comercio[]>("/api/v1/comercios"),
  organizaciones: () => apiFetch<OrganizacionReceptora[]>("/api/v1/organizaciones"),
  voluntarios: () => apiFetch<Voluntario[]>("/api/v1/voluntarios"),
  adminUsuarios: () => apiFetch<UsuarioAdmin[]>("/api/v1/admin/usuarios"),
  aprobarUsuario: (id: string) => apiFetch<{ mensaje: string; estado: string }>(`/api/v1/admin/usuarios/${id}/aprobar`, { method: "POST" }),
  rechazarUsuario: (id: string, motivo?: string) =>
    apiFetch<{ mensaje: string; estado: string }>(`/api/v1/admin/usuarios/${id}/rechazar`, {
      method: "POST",
      body: motivo ? { motivo } : undefined,
    }),
  desactivarUsuario: (id: string) => apiFetch<{ mensaje: string; estado: string }>(`/api/v1/admin/usuarios/${id}/desactivar`, { method: "POST" }),
  reactivarUsuario: (id: string) => apiFetch<{ mensaje: string; estado: string }>(`/api/v1/admin/usuarios/${id}/reactivar`, { method: "POST" }),
  fundacionComercios: () => apiFetch<ComercioGestion[]>("/api/v1/fundacion/comercios"),
  aprobarComercio: (id: string) => apiFetch<{ mensaje: string; estado: string }>(`/api/v1/fundacion/comercios/${id}/aprobar`, { method: "POST" }),
  desactivarComercio: (id: string) => apiFetch<{ mensaje: string; estado: string }>(`/api/v1/fundacion/comercios/${id}/desactivar`, { method: "POST" }),
  reactivarComercio: (id: string) => apiFetch<{ mensaje: string; estado: string }>(`/api/v1/fundacion/comercios/${id}/reactivar`, { method: "POST" }),
};
