"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";

/** El impacto es solo de la fundación (#51): sin sesión va al login y otro rol vuelve a su inicio. */
export function useSoloFundacion() {
  const router = useRouter();

  useEffect(() => {
    let vigente = true;
    if (!leerToken()) {
      router.replace("/login");
      return () => {
        vigente = false;
      };
    }
    sesionApi
      .me()
      .then((usuario) => {
        if (vigente && usuario.rol !== "fundacion") router.replace("/home");
      })
      .catch(() => {
        if (vigente) router.replace("/login");
      });
    return () => {
      vigente = false;
    };
  }, [router]);
}
