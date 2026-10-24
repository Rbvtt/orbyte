/**
 * Versión local de las APIs que aún no existen. Responde lo mismo que se espera de la API
 * real, incluidos los errores 403, 404 y 409, para que las pantallas queden terminadas.
 * TODO(#16, #37, #40, #44, #51): borrar este archivo al conectar las APIs reales.
 */

import type { Impacto, RescateSeguimiento, UsuarioActual } from "@/types/api";
import { ApiError } from "../client";
import { rescatesIniciales, USUARIOS, type RescateLocal } from "./datos";

let rescates: RescateLocal[] = rescatesIniciales();
let usuarioId = USUARIOS[0].id;

/** Simula la latencia de la red para que se vean los estados de carga. */
function responder<T>(valor: () => T, ms = 350): Promise<T> {
  return new Promise((resolver, rechazar) => {
    window.setTimeout(() => {
      try {
        resolver(valor());
      } catch (error) {
        rechazar(error);
      }
    }, ms);
  });
}

function usuario(): UsuarioActual {
  return USUARIOS.find((u) => u.id === usuarioId) ?? USUARIOS[0];
}

function buscar(id: string): RescateLocal {
  const r = rescates.find((x) => x.id === id);
  if (!r) throw new ApiError(404, "Este rescate no existe.", { detail: "Este rescate no existe." });
  return r;
}

function prohibido(mensaje: string): ApiError {
  return new ApiError(403, mensaje, { detail: mensaje });
}

function conflicto(mensaje: string, estado: string): ApiError {
  return new ApiError(409, mensaje, { detail: mensaje, estado_actual: estado });
}

/** Lo que devuelve la API: sin los campos internos y sin beneficiados para quien no puede verlos (RNF-005). */
function publico(r: RescateLocal, u: UsuarioActual): RescateSeguimiento {
  const resto: RescateSeguimiento & Partial<RescateLocal> = { ...r };
  delete resto.entregado_en;
  delete resto.kg_recibidos;
  const ve = u.rol === "fundacion" || (u.rol === "organizacion" && u.organizacion_id === r.organizacion_id);
  return { ...resto, pendiente_asignar: r.estado === "disponible", personas_beneficiadas: ve ? r.personas_beneficiadas : null };
}

function actualizar(id: string, cambios: Partial<RescateLocal>): RescateLocal {
  rescates = rescates.map((r) => (r.id === id ? { ...r, ...cambios } : r));
  return buscar(id);
}

export const local = {
  // ── Simulación (no existe en la API real) ──
  usuarios: () => USUARIOS,
  usuarioSimuladoId: () => usuarioId,
  simularUsuario: (id: string) => {
    usuarioId = id;
  },
  rescatesSimulados: () => rescates.map((r) => ({ id: r.id, numero: r.numero, estado: r.estado, alimento: r.alimento })),
  reiniciar: () => {
    rescates = rescatesIniciales();
  },

  // ── GET /api/v1/auth/me (#40) ──
  yo: () => responder(usuario, 100),

  // ── GET /api/v1/rescates/{id} (#37): mismas reglas por rol ──
  detalle: (id: string) =>
    responder(() => {
      const r = buscar(id);
      const u = usuario();
      const puede =
        u.rol === "fundacion" ||
        (u.rol === "voluntario" && r.voluntario_id === u.id) ||
        (u.rol === "organizacion" && u.organizacion_id !== null && r.organizacion_id === u.organizacion_id) ||
        (u.rol === "comercio" && u.comercio_id !== null && r.comercio_id === u.comercio_id);
      if (!puede) throw prohibido("No tienes acceso a este rescate.");
      return publico(r, u);
    }),

  // ── POST /api/v1/rescates/{id}/recogida (#16) ──
  registrarRecogida: (id: string) =>
    responder(() => {
      const r = buscar(id);
      const u = usuario();
      if (u.rol !== "voluntario" || r.voluntario_id !== u.id) throw prohibido("Solo el voluntario asignado registra la recogida.");
      if (r.estado !== "asignado") throw conflicto(`Este rescate ya no se puede recoger: su estado es «${r.estado}».`, r.estado);
      return publico(actualizar(id, { estado: "recogido", recogido_en: new Date().toISOString() }), u);
    }),

  // ── POST /api/v1/rescates/{id}/no-completado (#44) ──
  marcarNoCompletado: (id: string, motivo: string) =>
    responder(() => {
      const r = buscar(id);
      const u = usuario();
      if (u.rol !== "fundacion") throw prohibido("Solo la fundación marca un rescate como no completado.");
      if (!motivo.trim()) {
        throw new ApiError(422, "Escribe el motivo.", { detail: [{ campo: "motivo", mensaje: "Escribe el motivo." }] });
      }
      if (r.estado !== "disponible" && r.estado !== "asignado") {
        throw conflicto(`Este rescate ya no se puede cerrar: su estado es «${r.estado}».`, r.estado);
      }
      return publico(actualizar(id, { estado: "no_completado", motivo_no_completado: motivo.trim() }), u);
    }),

  // ── GET /api/v1/impacto?desde&hasta (#51): solo rescates entregados en el rango (CA-05.1) ──
  impacto: (desde: string, hasta: string) =>
    responder((): Impacto => {
      if (usuario().rol !== "fundacion") throw prohibido("El impacto lo consulta la fundación.");
      const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
      const enRango = rescates.filter((r) => {
        if (r.estado !== "entregado" || !r.entregado_en) return false;
        const d = dia.format(new Date(r.entregado_en));
        return d >= desde && d <= hasta;
      });
      return {
        desde,
        hasta,
        kg_rescatados: enRango.reduce((s, r) => s + (r.kg_recibidos ?? 0), 0).toFixed(1),
        personas_beneficiadas: enRango.reduce((s, r) => s + (r.personas_beneficiadas ?? 0), 0),
        organizaciones_receptoras: new Set(enRango.map((r) => r.organizacion_id)).size,
      };
    }),
};
