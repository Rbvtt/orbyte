import type { RescateCrear, RescateCreado } from "@/types/avisos";
import { apiFetch } from "./client";

export const avisosApi = {
  /**
   * POST /api/v1/rescates (#6). Un reintento con la misma Idempotency-Key devuelve el mismo
   * aviso (cabecera `Idempotent-Replay: true`); la misma clave con otro contenido responde 409.
   */
  registrar: (datos: RescateCrear, claveIdempotencia: string) =>
    apiFetch<RescateCreado>("/api/v1/rescates", {
      method: "POST",
      body: datos,
      headers: { "Idempotency-Key": claveIdempotencia },
    }),
};
