import { Suspense } from "react";
import EditarAviso from "./EditarAviso";

export default function PaginaEditarAviso() {
  return (
    <Suspense fallback={<p className="page" role="status">Cargando aviso…</p>}>
      <EditarAviso />
    </Suspense>
  );
}
