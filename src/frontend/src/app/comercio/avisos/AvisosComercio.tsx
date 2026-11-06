"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "@/components/ui/StatusPill";
import { dia, hora24 } from "@/features/rescates/tiempo";
import { useAhora } from "@/features/rescates/useAhora";
import { leerToken } from "@/services/api/sesion";
import { ApiError } from "@/services/api/client";
import { rescatesApi } from "@/services/api/rescates";
import { sesionApi } from "@/services/api/sesionApi";
import type { RescateAvisoComercio } from "@/types/rescates";
import styles from "./avisos.module.css";

type Filtro = "todos" | "disponible" | "vencido" | "asignado" | "finalizados";

export default function AvisosComercioPage() {
  const router = useRouter();
  const [avisos, setAvisos] = useState<RescateAvisoComercio[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [cargando, setCargando] = useState(true);
  const [accionEnCurso, setAccionEnCurso] = useState("");
  const [error, setError] = useState("");
  const ahora = useAhora();

  useEffect(() => {
    let activo = true;
    if (!leerToken()) {
      router.replace("/login");
      return () => {
        activo = false;
      };
    }

    async function cargar() {
      try {
        const usuario = await sesionApi.me();
        if (usuario.rol !== "comercio") {
          router.replace("/home");
          return;
        }
        const lista = await rescatesApi.misAvisos();
        if (activo) setAvisos(lista);
      } catch (reason) {
        if (!activo) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : "No se pudieron cargar tus avisos.");
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => {
      activo = false;
    };
  }, [router]);

  const visibles = useMemo(
    () => avisos.filter((aviso) => coincideFiltro(aviso, filtro, ahora)),
    [avisos, filtro, ahora],
  );

  async function cancelar(aviso: RescateAvisoComercio) {
    const confirmado = window.confirm(
      `¿Cancelar el aviso de ${aviso.alimento}? El registro quedará en el historial como no completado.`,
    );
    if (!confirmado) return;
    setAccionEnCurso(aviso.id);
    setError("");
    try {
      const actualizado = await rescatesApi.cancelarAviso(aviso.id);
      setAvisos((actuales) => actuales.map((item) => item.id === aviso.id ? actualizado : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cancelar el aviso.");
    } finally {
      setAccionEnCurso("");
    }
  }

  const conteos = {
    todos: avisos.length,
    disponible: avisos.filter((aviso) => aviso.estado === "disponible" && Date.parse(aviso.hora_limite) > ahora.getTime()).length,
    vencido: avisos.filter((aviso) => aviso.estado === "disponible" && Date.parse(aviso.hora_limite) <= ahora.getTime()).length,
    asignado: avisos.filter((aviso) => aviso.estado === "asignado").length,
    finalizados: avisos.filter((aviso) => aviso.estado === "entregado" || aviso.estado === "no_completado").length,
  };

  if (cargando) {
    return <main className={styles.pagina}><p className={styles.cargando} role="status">Cargando tus avisos…</p></main>;
  }

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <div className={styles.migas}>Orbyte <span>/</span> Comercio <span>/</span> Mis avisos</div>
        <header className={styles.hero}>
          <div>
            <span className={styles.kicker}>Donaciones de mi comercio</span>
            <h1>Gestiona tus avisos</h1>
            <p>Consulta el avance de tus donaciones y actualiza las que todavía están disponibles.</p>
          </div>
          <Link className={styles.nuevo} href="/aviso/nuevo">+ Publicar alimentos</Link>
        </header>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <nav className={styles.filtros} aria-label="Filtrar avisos">
          {([
            ["todos", "Todos"],
            ["disponible", "Disponibles"],
            ["vencido", "Vencidos"],
            ["asignado", "Asignados"],
            ["finalizados", "Finalizados"],
          ] as const).map(([valor, texto]) => (
            <button
              key={valor}
              className={filtro === valor ? styles.filtroActivo : styles.filtro}
              type="button"
              aria-pressed={filtro === valor}
              onClick={() => setFiltro(valor)}
            >
              {texto}<span>{conteos[valor]}</span>
            </button>
          ))}
        </nav>

        {visibles.length === 0 ? (
          <section className={styles.vacio}>
            <strong>{avisos.length ? "No hay avisos en esta categoría" : "Todavía no has publicado avisos"}</strong>
            <p>{avisos.length ? "Selecciona otro filtro para consultar tus donaciones." : "Cuando publiques una donación, podrás consultar y gestionar su avance aquí."}</p>
            {!avisos.length && <Link href="/aviso/nuevo">Crear mi primer aviso</Link>}
          </section>
        ) : (
          <section className={styles.lista} aria-label="Mis avisos">
            {visibles.map((aviso) => {
              const vencido = aviso.estado === "disponible" && Date.parse(aviso.hora_limite) <= ahora.getTime();
              const editable = aviso.estado === "disponible" && !vencido;
              return (
                <article className={styles.tarjeta} key={aviso.id}>
                  <div className={styles.cabeceraTarjeta}>
                    <div className={styles.titulo}>
                      <span className={styles.kicker}>Donación</span>
                      <h2>{aviso.alimento}</h2>
                      <p>{aviso.cantidad_aprox}</p>
                    </div>
                    <StatusPill estado={vencido ? "no_disponible" : aviso.estado} />
                  </div>

                  <dl className={styles.datos}>
                    <div><dt>Lugar de recogida</dt><dd>{aviso.lugar_recogida}</dd></div>
                    <div>
                      <dt>Hora límite</dt>
                      <dd>{dia(aviso.hora_limite, ahora)}, {hora24(new Date(aviso.hora_limite))} h</dd>
                    </div>
                    <div><dt>Publicado</dt><dd>{new Date(aviso.creado_en).toLocaleString("es-CO")}</dd></div>
                    {aviso.motivo_no_completado && (
                      <div><dt>Motivo</dt><dd>{aviso.motivo_no_completado}</dd></div>
                    )}
                  </dl>

                  <div className={styles.acciones}>
                    <Link href={`/rescates/${aviso.id}`} className={styles.secundario}>Ver seguimiento</Link>
                    {editable ? (
                      <>
                        <Link href={`/comercio/avisos/${aviso.id}/editar`} className={styles.primario}>Editar aviso</Link>
                        <button
                          type="button"
                          className={styles.cancelar}
                          disabled={accionEnCurso === aviso.id}
                          onClick={() => void cancelar(aviso)}
                        >
                          {accionEnCurso === aviso.id ? "Cancelando…" : "Cancelar aviso"}
                        </button>
                      </>
                    ) : vencido ? (
                      <span className={styles.vencido}>Venció la hora límite. Contacta a la Fundación; el estado se conserva hasta que lo actualice.</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function coincideFiltro(aviso: RescateAvisoComercio, filtro: Filtro, ahora: Date): boolean {
  if (filtro === "todos") return true;
  if (filtro === "finalizados") return aviso.estado === "entregado" || aviso.estado === "no_completado";
  if (filtro === "vencido") return aviso.estado === "disponible" && Date.parse(aviso.hora_limite) <= ahora.getTime();
  if (filtro === "disponible") return aviso.estado === filtro && Date.parse(aviso.hora_limite) > ahora.getTime();
  return aviso.estado === filtro;
}
