"use client";

import { useEffect, useState } from "react";

/** Reloj de la pantalla: el tiempo restante se recalcula cada 30 segundos. */
export function useAhora(intervaloMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), intervaloMs);
    return () => window.clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}
