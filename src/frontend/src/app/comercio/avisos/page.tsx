import { Suspense } from "react";
import AvisosComercio from "./AvisosComercio";

export default function PaginaAvisosComercio() {
  return (
    <Suspense fallback={<p className="page" role="status">Cargando tus avisos…</p>}>
      <AvisosComercio />
    </Suspense>
  );
}
