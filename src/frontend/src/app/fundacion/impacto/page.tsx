import type { Metadata } from "next";
import { Suspense } from "react";
import { Impacto } from "@/features/impacto/Impacto";

export const metadata: Metadata = { title: "Impacto" };

/** CMP-05 · /fundacion/impacto (#52, #21). Suspense: el periodo inicial depende de la fecha de hoy. */
export default function PaginaImpacto() {
  return (
    <Suspense>
      <Impacto />
    </Suspense>
  );
}
