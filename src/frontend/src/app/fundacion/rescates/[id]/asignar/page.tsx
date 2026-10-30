import type { Metadata } from "next";
import { Suspense } from "react";
import { AsignarRescate } from "@/features/rescates/AsignarRescate";

export const metadata: Metadata = { title: "Asignar rescate" };

/** CMP-02 · /fundacion/rescates/[id]/asignar (#39). Suspense: la pantalla lee el id de la ruta. */
export default function PaginaAsignar() {
  return (
    <Suspense>
      <AsignarRescate />
    </Suspense>
  );
}
