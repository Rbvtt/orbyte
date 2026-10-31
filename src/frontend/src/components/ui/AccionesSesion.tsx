"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cerrarSesion, leerToken, suscribirSesion } from "@/services/api/sesion";
import styles from "./AccionesSesion.module.css";

export function AccionesSesion() {
  const router = useRouter();
  const autenticado = useSyncExternalStore(
    suscribirSesion,
    () => Boolean(leerToken()),
    () => false,
  );

  if (!autenticado) return null;

  function salir() {
    cerrarSesion();
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className={styles.barra} aria-label="Sesión">
      <button type="button" className={styles.boton} onClick={salir}>
        Cerrar sesión
      </button>
    </nav>
  );
}
