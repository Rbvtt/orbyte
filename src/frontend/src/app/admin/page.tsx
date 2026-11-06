"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";
import type { UsuarioAdmin } from "@/types/api";
import { IconoPersonaCheck } from "@/components/ui/Iconos";
import styles from "./admin.module.css";

export default function AdminPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    if (!leerToken()) {
      router.replace("/login");
      return;
    }

    try {
      const actual = await sesionApi.me();
      if (actual.rol !== "administrador") {
        router.replace("/home");
        return;
      }
      const lista = await sesionApi.adminUsuarios();
      setUsuarios(lista);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar la administración.");
    } finally {
      setCargando(false);
    }
  }

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
      .then((actual) => {
        if (!activo) return;
        if (actual.rol !== "administrador") {
          router.replace("/home");
          return;
        }
        return sesionApi.adminUsuarios().then((lista) => {
          if (activo) setUsuarios(lista);
        });
      })
      .catch((reason) => {
        if (activo) setError(reason instanceof Error ? reason.message : "No se pudo cargar la administración.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [router]);

  async function accion(id: string, fn: () => Promise<{ mensaje: string; estado: string }>) {
    try {
      await fn();
      await cargar();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo ejecutar la acción.");
    }
  }

  if (cargando) {
    return (
      <main className={styles.pagina}>
        <div className={styles.cargando} role="status">Cargando solicitudes…</div>
      </main>
    );
  }

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <div className={styles.migas}>Orbyte <span>/</span> Administración</div>

        <section className={styles.hero}>
          <div className={styles.heroIcono}><IconoPersonaCheck tamano={28} /></div>
          <div>
            <span className={styles.kicker}>Acceso y confianza</span>
            <h1>Solicitudes de cuenta</h1>
            <p>Revisa la información y aprueba las cuentas de fundaciones y comercios.</p>
          </div>
          <span className={styles.contador}>{usuarios.length}<small>pendientes</small></span>
        </section>

        {error && (
          <div className={styles.error} role="alert">
            <strong>No se pudo completar la acción.</strong>
            <span>{error}</span>
          </div>
        )}

        <section className={styles.lista} aria-labelledby="solicitudes-titulo">
          <div className={styles.listaEncabezado}>
            <div>
              <h2 id="solicitudes-titulo">Cuentas pendientes de aprobación</h2>
              <p>Solo se muestran solicitudes de fundaciones y comercios.</p>
            </div>
            <span>{usuarios.length} {usuarios.length === 1 ? "solicitud" : "solicitudes"}</span>
          </div>

          {usuarios.length === 0 ? (
            <div className={styles.vacio}>
              <span className={styles.vacioIcono}><IconoPersonaCheck tamano={25} /></span>
              <strong>Todo al día</strong>
              <p>No hay solicitudes pendientes por revisar.</p>
            </div>
          ) : (
            <div className={styles.tarjetas}>
              {usuarios.map((usuario) => (
                <article key={usuario.id} className={styles.usuario}>
                  <div className={styles.usuarioCabecera}>
                    <span className={styles.avatar}>{usuario.nombre.trim().charAt(0).toUpperCase()}</span>
                    <div className={styles.identidad}>
                      <strong>{usuario.nombre}</strong>
                      <span>{usuario.email}</span>
                    </div>
                    <span className={styles.rol}>{usuario.rol === "fundacion" ? "Fundación" : "Comercio"}</span>
                  </div>
                  {usuario.motivo_rechazo && <p className={styles.motivo}>Motivo anterior: {usuario.motivo_rechazo}</p>}
                  <div className={styles.acciones}>
                    <button className={styles.aprobar} type="button" onClick={() => accion(usuario.id, () => sesionApi.aprobarUsuario(usuario.id))}>
                      Aprobar cuenta
                    </button>
                    <button className={styles.rechazar} type="button" onClick={() => accion(usuario.id, () => sesionApi.rechazarUsuario(usuario.id, "Cuenta revisada por administración."))}>
                      Rechazar
                    </button>
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
