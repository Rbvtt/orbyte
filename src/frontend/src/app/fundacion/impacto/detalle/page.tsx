import type { Metadata } from "next";
import { Suspense } from "react";
import { DetalleImpacto } from "@/features/impacto/DetalleImpacto";

export const metadata: Metadata = { title: "Detalle del impacto" };

/** #22 · Rescates que componen un total (enlazado desde cada total de /fundacion/impacto, #52). */
export default function PaginaDetalleImpacto() {
  return (
    <Suspense fallback={<main className="page"><p role="status">Preparando el detalle…</p></main>}>
      <DetalleImpacto />
    </Suspense>
  );
}
