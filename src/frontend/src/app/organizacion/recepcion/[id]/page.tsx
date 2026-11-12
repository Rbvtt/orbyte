import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmarRecepcion } from "@/features/recepcion/ConfirmarRecepcion";

export const metadata: Metadata = { title: "Confirmar recepción" };

export default function PaginaConfirmarRecepcion() {
  return (
    <Suspense>
      <ConfirmarRecepcion />
    </Suspense>
  );
}
