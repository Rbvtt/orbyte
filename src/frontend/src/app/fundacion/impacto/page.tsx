import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsultaImpacto } from "@/features/impacto/ConsultaImpacto";

export const metadata: Metadata = { title: "Impacto del periodo" };

export default function PaginaImpacto() {
  return (
    <Suspense fallback={<main className="page"><p role="status">Preparando el reporte…</p></main>}>
      <ConsultaImpacto />
    </Suspense>
  );
}
