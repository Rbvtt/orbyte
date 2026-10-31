import type { Comercio, UsuarioSesion } from "@/types/api";
import { apiFetch } from "./client";
import { guardarToken } from "./sesion";

type LoginRespuesta = { access_token: string; token_type: string };

export const sesionApi = {
  login: async (email: string, password: string): Promise<UsuarioSesion> => {
    const token = await apiFetch<LoginRespuesta>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    guardarToken(token.access_token);
    return apiFetch<UsuarioSesion>("/api/v1/auth/me");
  },
  me: () => apiFetch<UsuarioSesion>("/api/v1/auth/me"),
  comercios: () => apiFetch<Comercio[]>("/api/v1/comercios"),
};
