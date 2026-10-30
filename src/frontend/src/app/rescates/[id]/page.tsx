import type { Metadata } from "next";
import { Suspense } from "react";
import { DetalleRescate } from "@/features/seguimiento/DetalleRescate";

export const metadata: Metadata = { title: "Rescate" };

/** CMP-02 · /rescates/[id] (#12), con las acciones de #44 y #45. Suspense: lee el id de la ruta. */
export default function PaginaRescate() {
  return (
    <Suspense>
      <DetalleRescate />
    </Suspense>
  );
}
