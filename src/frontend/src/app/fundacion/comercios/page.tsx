"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconoTienda } from "@/components/ui/Iconos";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";
import type { ComercioGestion } from "@/types/api";
import styles from "./comercios.module.css";

type Filtro = "todos" | ComercioGestion["estado"];

const ETIQUETAS_ESTADO: Record<ComercioGestion["estado"], string> = {
  pendiente: "Pendiente",
  aprobado: "Activo",
  rechazado: "Rechazado",
  inactivo: "Desactivado",
};

export default function GestionComerciosPage() {
  const router = useRouter();
  const [comercios, setComercios] = useState<ComercioGestion[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [accionEnCurso, setAccionEnCurso] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    if (!leerToken()) {
      router.replace("/login");
      return () => {
        activo = false;
      };
    }

    sesionApi
      .me()
      .then((usuario) => {
        if (!activo) return;
        if (usuario.rol !== "fundacion") {
          router.replace("/home");
          return;
        }
        return sesionApi.fundacionComercios().then((lista) => {
          if (activo) setComercios(lista);
        });
      })
      .catch((reason) => {
        if (activo) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los comercios.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [router]);

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase();
    return comercios.filter((comercio) => {
      const coincideEstado = filtro === "todos" || comercio.estado === filtro;
      const coincideBusqueda =
        !termino ||
        [comercio.nombre, comercio.email, comercio.direccion]
          .join(" ")
          .toLocaleLowerCase()
          .includes(termino);
      return coincideEstado && coincideBusqueda;
    });
  }, [busqueda, comercios, filtro]);

  async function cambiarEstado(
    comercio: ComercioGestion,
    operacion: "aprobar" | "desactivar" | "reactivar",
  ) {
    setAccionEnCurso(comercio.id);
    setError("");
    try {
      const respuesta =
        operacion === "aprobar"
          ? await sesionApi.aprobarComercio(comercio.id)
          : operacion === "desactivar"
            ? await sesionApi.desactivarComercio(comercio.id)
            : await sesionApi.reactivarComercio(comercio.id);
      setComercios((actuales) =>
        actuales.map((item) =>
          item.id === comercio.id
            ? {
                ...item,
                estado: respuesta.estado as ComercioGestion["estado"],
                activo: respuesta.estado === "aprobado",
                motivo_rechazo: null,
              }
            : item,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la cuenta del comercio.");
    } finally {
      setAccionEnCurso("");
    }
  }

  const pendientes = comercios.filter((comercio) => comercio.estado === "pendiente").length;
  const activos = comercios.filter((comercio) => comercio.estado === "aprobado").length;
  const desactivados = comercios.filter((comercio) => comercio.estado === "inactivo").length;

  if (cargando) {
    return (
      <main className={styles.pagina}>
        <div className={styles.cargando} role="status">Cargando comercios…</div>
      </main>
    );
  }

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <div className={styles.migas}>Orbyte <span>/</span> Fundación <span>/</span> Comercios</div>

        <section className={styles.hero}>
          <div className={styles.heroIcono}><IconoTienda tamano={28} /></div>
          <div className={styles.heroTexto}>
            <span className={styles.kicker}>Red de comercios</span>
            <h1>Gestionar comercios</h1>
            <p>Revisa las cuentas de los comercios y mantén actualizados sus permisos de acceso.</p>
          </div>
          <div className={styles.resumen} aria-label="Resumen de comercios">
            <div><strong>{pendientes}</strong><span>Pendientes</span></div>
            <div><strong>{activos}</strong><span>Activos</span></div>
            <div><strong>{desactivados}</strong><span>Desactivados</span></div>
          </div>
        </section>

        {error && (
          <div className={styles.error} role="alert">
            <strong>No se pudo completar la solicitud.</strong>
            <span>{error}</span>
          </div>
        )}

        <section className={styles.panel} aria-labelledby="listado-comercios">
          <div className={styles.encabezado}>
            <div>
              <span className={styles.sobrelinea}>Administración de cuentas</span>
              <h2 id="listado-comercios">Comercios registrados</h2>
              <p>Aprueba cuentas pendientes o cambia el acceso de comercios activos.</p>
            </div>
            <label className={styles.buscar}>
              <span className={styles.soloLector}>Buscar comercios</span>
              <input
                type="search"
                placeholder="Buscar por nombre, correo o dirección"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </label>
          </div>

          <div className={styles.filtros} aria-label="Filtrar comercios">
            {(["todos", "pendiente", "aprobado", "inactivo", "rechazado"] as const).map((estado) => {
              const cantidad =
                estado === "todos" ? comercios.length : comercios.filter((item) => item.estado === estado).length;
              const texto = estado === "todos" ? "Todos" : ETIQUETAS_ESTADO[estado];
              return (
                <button
                  key={estado}
                  className={filtro === estado ? styles.filtroActivo : styles.filtro}
                  type="button"
                  aria-pressed={filtro === estado}
                  onClick={() => setFiltro(estado)}
                >
                  {texto}<span>{cantidad}</span>
                </button>
              );
            })}
          </div>

          {visibles.length === 0 ? (
            <div className={styles.vacio}>
              <span className={styles.vacioIcono}><IconoTienda tamano={25} /></span>
              <strong>{comercios.length ? "No hay resultados para este filtro" : "Aún no hay comercios registrados"}</strong>
              <p>{comercios.length ? "Prueba con otro estado o término de búsqueda." : "Cuando se registren comercios, podrás gestionarlos desde aquí."}</p>
            </div>
          ) : (
            <div className={styles.lista}>
              {visibles.map((comercio) => (
                <article className={styles.comercio} key={comercio.id}>
                  <div className={styles.identidad}>
                    <span className={styles.avatar}>{comercio.nombre.trim().charAt(0).toUpperCase()}</span>
                    <div className={styles.datos}>
                      <strong>{comercio.nombre}</strong>
                      <span>{comercio.email}</span>
                    </div>
                    <span className={`${styles.estado} ${styles[`estado_${comercio.estado}`]}`}>
                      {ETIQUETAS_ESTADO[comercio.estado]}
                    </span>
                  </div>

                  <dl className={styles.detalles}>
                    <div><dt>Dirección</dt><dd>{comercio.direccion}</dd></div>
                    <div><dt>Teléfono</dt><dd>{comercio.telefono || "No registrado"}</dd></div>
                  </dl>

                  {comercio.motivo_rechazo && (
                    <p className={styles.motivo}>Motivo de rechazo: {comercio.motivo_rechazo}</p>
                  )}

                  <div className={styles.acciones}>
                    {(comercio.estado === "pendiente" || comercio.estado === "rechazado") && (
                      <button
                        className={styles.primario}
                        type="button"
                        disabled={accionEnCurso === comercio.id}
                        onClick={() => cambiarEstado(comercio, "aprobar")}
                      >
                        {accionEnCurso === comercio.id ? "Actualizando…" : "Aprobar comercio"}
                      </button>
                    )}
                    {comercio.estado === "aprobado" && (
                      <button
                        className={styles.secundario}
                        type="button"
                        disabled={accionEnCurso === comercio.id}
                        onClick={() => cambiarEstado(comercio, "desactivar")}
                      >
                        {accionEnCurso === comercio.id ? "Actualizando…" : "Desactivar cuenta"}
                      </button>
                    )}
                    {comercio.estado === "inactivo" && (
                      <button
                        className={styles.primario}
                        type="button"
                        disabled={accionEnCurso === comercio.id}
                        onClick={() => cambiarEstado(comercio, "reactivar")}
                      >
                        {accionEnCurso === comercio.id ? "Actualizando…" : "Reactivar cuenta"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
