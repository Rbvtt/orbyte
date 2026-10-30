import type { Metadata } from "next";
import { Suspense } from "react";
import { RescatesActivos } from "@/features/rescates/RescatesActivos";

export const metadata: Metadata = { title: "Rescates activos" };

/** CMP-03 · /fundacion/rescates (#38). Suspense: la tabla depende de la hora actual del navegador. */
export default function PaginaRescatesActivos() {
  return (
    <Suspense>
      <RescatesActivos />
    </Suspense>
  );
}
