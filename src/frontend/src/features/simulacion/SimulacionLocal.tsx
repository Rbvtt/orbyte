"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { local } from "@/services/api/local/api";
import { USAR_DATOS_LOCALES } from "@/services/api/modo";
import styles from "./SimulacionLocal.module.css";

const ROL: Record<string, string> = {
  fundacion: "Fundación",
  voluntario: "Voluntario",
  organizacion: "Organización",
  comercio: "Comercio",
};

/**
 * Panel para probar las pantallas sin backend: elegir con qué usuario se ve y qué rescate abrir.
 * Solo aparece con datos locales.
 * TODO(#16, #37, #40, #44, #51): borrar este componente al conectar las APIs reales.
 */
export function SimulacionLocal({ alCambiar, conRescates = false }: { alCambiar: () => void; conRescates?: boolean }) {
  const [usuarioId, setUsuarioId] = useState(() => (USAR_DATOS_LOCALES ? local.usuarioSimuladoId() : ""));
  if (!USAR_DATOS_LOCALES) return null;

  return (
    <aside className={styles.panel} aria-label="Simulación local">
      <p className={styles.titulo}>Datos de ejemplo · sin backend</p>
      <label className={styles.fila}>
        Ver como
        <select
          className="select"
          value={usuarioId}
          onChange={(e) => {
            local.simularUsuario(e.target.value);
            setUsuarioId(e.target.value);
            alCambiar();
          }}
        >
          {local.usuarios().map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} ({ROL[u.rol]})
            </option>
          ))}
        </select>
      </label>
      {conRescates && (
        <ul className={styles.rescates}>
          {local.rescatesSimulados().map((r) => (
            <li key={r.id}>
              <Link href={`/rescates/${r.id}`}>
                n.º {r.numero} · {r.alimento}
              </Link>{" "}
              <StatusPill estado={r.estado} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
