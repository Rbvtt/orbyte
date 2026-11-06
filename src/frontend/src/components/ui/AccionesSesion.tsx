"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cerrarSesion, leerToken, suscribirSesion } from "@/services/api/sesion";
import styles from "./AccionesSesion.module.css";

export function BotonVolver() {
  const router = useRouter();

  function volver() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/home");
  }

  return (
    <button type="button" className={styles.boton} onClick={volver}>
      ← Volver
    </button>
  );
}

export function TopNavigation() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <div className={styles.barra}>
      <BotonVolver />
      <AccionesSesion />
    </div>
  );
}

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
    <button type="button" className={styles.boton} onClick={salir}>
      Cerrar sesión
    </button>
  );
}
