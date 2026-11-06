import { Suspense } from "react";
import AsignarRescate from "./AsignarRescate";

export default function PaginaAsignarRescate() {
  return (
    <Suspense fallback={<p className="page" role="status">Cargando rescate…</p>}>
      <AsignarRescate />
    </Suspense>
  );
}
