import type { Metadata } from "next";
import { FormularioAviso } from "@/features/avisos/FormularioAviso";

export const metadata: Metadata = { title: "Avisar donación" };

/** CMP-01 · /aviso/nuevo (#8) */
export default function PaginaNuevoAviso() {
  return (
    <div className="page page--narrow">
      <div className="title-row" style={{ marginBottom: 12 }}>
        <h1>Avisar donación</h1>
      </div>
      <FormularioAviso />
    </div>
  );
}
