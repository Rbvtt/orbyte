import type { Metadata } from "next";
import { Suspense } from "react";
import { IconoBrote } from "@/components/ui/Iconos";
import { FormularioAviso } from "@/features/avisos/FormularioAviso";
import styles from "./pagina.module.css";

export const metadata: Metadata = { title: "Aviso de donación" };

/** CMP-01 · /aviso/nuevo (#8), con la cabecera del prototipo de #7. Suspense: usa la fecha de hoy. */
export default function PaginaNuevoAviso() {
  return (
    <div className={styles.pantalla}>
      <header className={styles.cabecera}>
        <span className={styles.marca}>
          <span className={styles.logo}>
            <IconoBrote tamano={18} />
          </span>
          Mesa común
        </span>
        <span className={styles.seccion}>Red de donación</span>
      </header>
      <div className={styles.contenido}>
        <Suspense>
          <FormularioAviso />
        </Suspense>
      </div>
    </div>
  );
}
