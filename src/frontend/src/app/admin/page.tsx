"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconoBalanza, IconoCamion, IconoPersonaCheck } from "@/components/ui/Iconos";
import { leerToken } from "@/services/api/sesion";
import { rescatesApi } from "@/services/api/rescates";
import { sesionApi } from "@/services/api/sesionApi";
import type { UsuarioAdmin } from "@/types/api";
import type { RescateAdmin } from "@/types/rescates";
import styles from "./admin.module.css";

type Seccion = "usuarios" | "donaciones";
type RolFiltro = UsuarioAdmin["rol"] | "todos";
type EstadoUsuarioFiltro = UsuarioAdmin["estado"] | "todos";
type EstadoDonacionFiltro = RescateAdmin["estado"] | "todos";

const nombresRol: Record<UsuarioAdmin["rol"], string> = {
  administrador: "Administrador",
  fundacion: "Fundación",
  voluntario: "Voluntario",
  organizacion: "Organización",
  comercio: "Comercio",
};

const nombresEstadoUsuario: Record<UsuarioAdmin["estado"], string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  inactivo: "Inactivo",
};

const nombresEstadoDonacion: Record<RescateAdmin["estado"], string> = {
  disponible: "Disponible",
  asignado: "Asignada",
  recogido: "Recogida",
  entregado: "Entregada",
  no_completado: "No completada",
};

function mostrarFecha(fecha: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(fecha));
}

export default function AdminPage() {
  const router = useRouter();
  const [seccion, setSeccion] = useState<Seccion>("usuarios");
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [donaciones, setDonaciones] = useState<RescateAdmin[]>([]);
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false);
  const [rolFiltro, setRolFiltro] = useState<RolFiltro>("todos");
  const [estadoUsuarioFiltro, setEstadoUsuarioFiltro] = useState<EstadoUsuarioFiltro>("todos");
  const [estadoDonacionFiltro, setEstadoDonacionFiltro] = useState<EstadoDonacionFiltro>("todos");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
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
      setCargando(true);
      setError("");
      const [listaUsuarios, listaDonaciones] = await Promise.all([
        sesionApi.adminUsuarios(),
        rescatesApi.adminListado({ archivado: mostrarArchivadas }),
      ]);
      setUsuarios(listaUsuarios);
      setDonaciones(listaDonaciones);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar la administración.");
    } finally {
      setCargando(false);
    }
  }, [mostrarArchivadas, router]);

  useEffect(() => {
    let activo = true;
    void Promise.resolve().then(() => {
      if (activo) return cargar();
      return undefined;
    });
    return () => {
      activo = false;
    };
  }, [cargar]);

  const usuariosFiltrados = useMemo(
    () =>
      usuarios.filter(
        (usuario) =>
          (rolFiltro === "todos" || usuario.rol === rolFiltro) &&
          (estadoUsuarioFiltro === "todos" || usuario.estado === estadoUsuarioFiltro),
      ),
    [estadoUsuarioFiltro, rolFiltro, usuarios],
  );

  const donacionesFiltradas = useMemo(
    () =>
      donaciones.filter(
        (donacion) => estadoDonacionFiltro === "todos" || donacion.estado === estadoDonacionFiltro,
      ),
    [donaciones, estadoDonacionFiltro],
  );

  async function actualizarUsuario(usuario: UsuarioAdmin, accion: "aprobar" | "rechazar" | "desactivar" | "reactivar") {
    setOcupado(usuario.id);
    setError("");
    try {
      if (accion === "aprobar") await sesionApi.aprobarUsuario(usuario.id);
      if (accion === "rechazar") await sesionApi.rechazarUsuario(usuario.id, "Cuenta revisada por administración.");
      if (accion === "desactivar") await sesionApi.desactivarUsuario(usuario.id);
      if (accion === "reactivar") await sesionApi.reactivarUsuario(usuario.id);
      await cargar();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la cuenta.");
    } finally {
      setOcupado("");
    }
  }

  async function cambiarArchivo(donacion: RescateAdmin) {
    const accion = mostrarArchivadas ? "restaurar" : "archivar";
    const pregunta = mostrarArchivadas
      ? "¿Quieres restaurar esta donación en el listado principal?"
      : "¿Quieres retirar esta donación finalizada o vencida del listado principal?";
    if (!window.confirm(pregunta)) return;

    setOcupado(donacion.id);
    setError("");
    try {
      if (accion === "archivar") await rescatesApi.adminArchivar(donacion.id);
      else await rescatesApi.adminRestaurar(donacion.id);
      setDonaciones(await rescatesApi.adminListado({ archivado: mostrarArchivadas }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar la donación.");
    } finally {
      setOcupado("");
    }
  }

  if (cargando) {
    return (
      <main className={styles.pagina}>
        <div className={styles.cargando} role="status">Cargando panel de administración…</div>
      </main>
    );
  }

  const pendientes = usuarios.filter((usuario) => usuario.estado === "pendiente").length;
  const enCurso = donaciones.filter((donacion) =>
    ["disponible", "asignado", "recogido"].includes(donacion.estado),
  ).length;

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <div className={styles.migas}>Orbyte <span>/</span> Administración</div>

        <section className={styles.hero}>
          <div className={styles.heroIcono}><IconoPersonaCheck tamano={28} /></div>
          <div className={styles.heroTexto}>
            <span className={styles.kicker}>Centro de control</span>
            <h1>Administración</h1>
            <p>Gestiona las cuentas y supervisa cada etapa de las donaciones de la app.</p>
          </div>
          <div className={styles.resumen}>
            <span><strong>{usuarios.length}</strong> usuarios</span>
            <span><strong>{pendientes}</strong> pendientes</span>
            <span><strong>{enCurso}</strong> donaciones en curso</span>
          </div>
        </section>

        {error && (
          <div className={styles.error} role="alert">
            <strong>No se pudo completar la acción.</strong>
            <span>{error}</span>
          </div>
        )}

        <nav className={styles.pestanas} aria-label="Secciones de administración">
          <button type="button" aria-pressed={seccion === "usuarios"} onClick={() => setSeccion("usuarios")}>
            <IconoPersonaCheck tamano={18} /> Usuarios <span>{usuarios.length}</span>
          </button>
          <button type="button" aria-pressed={seccion === "donaciones"} onClick={() => setSeccion("donaciones")}>
            <IconoCamion tamano={18} /> Donaciones <span>{donaciones.length}</span>
          </button>
        </nav>
        <Link className={styles.enlaceImpacto} href="/admin/impacto">
          <IconoBalanza tamano={19} />
          <span><strong>Consulta de impacto</strong><small>Revisa indicadores y sus donaciones de respaldo</small></span>
        </Link>

        {seccion === "usuarios" ? (
          <section className={styles.seccion} aria-labelledby="usuarios-titulo">
            <div className={styles.encabezadoSeccion}>
              <div>
                <h2 id="usuarios-titulo">Usuarios por rol y estado</h2>
                <p>Las cuentas de fundaciones y comercios pueden aprobarse, rechazarse o desactivarse.</p>
              </div>
              <div className={styles.filtros}>
                <label>
                  <span>Rol</span>
                  <select value={rolFiltro} onChange={(event) => setRolFiltro(event.target.value as RolFiltro)}>
                    <option value="todos">Todos los roles</option>
                    {Object.entries(nombresRol).map(([rol, nombre]) => <option key={rol} value={rol}>{nombre}</option>)}
                  </select>
                </label>
                <label>
                  <span>Estado</span>
                  <select
                    value={estadoUsuarioFiltro}
                    onChange={(event) => setEstadoUsuarioFiltro(event.target.value as EstadoUsuarioFiltro)}
                  >
                    <option value="todos">Todos los estados</option>
                    {Object.entries(nombresEstadoUsuario).map(([estado, nombre]) => <option key={estado} value={estado}>{nombre}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {usuariosFiltrados.length === 0 ? (
              <div className={styles.vacio}>
                <strong>No hay cuentas para mostrar</strong>
                <p>Prueba con otro rol o estado.</p>
              </div>
            ) : (
              <div className={styles.tarjetas}>
                {usuariosFiltrados.map((usuario) => {
                  const puedeGestionar = usuario.rol !== "administrador";
                  const puedeAprobar = usuario.rol === "fundacion" || usuario.rol === "comercio";
                  return (
                    <article key={usuario.id} className={styles.tarjeta}>
                      <div className={styles.tarjetaCabecera}>
                        <span className={styles.avatar}>{usuario.nombre.trim().charAt(0).toUpperCase()}</span>
                        <div className={styles.identidad}>
                          <strong>{usuario.nombre}</strong>
                          <span>{usuario.email}</span>
                        </div>
                        <span className={styles.rol}>{nombresRol[usuario.rol]}</span>
                      </div>
                      <div className={styles.metaUsuario}>
                        <span className={`${styles.estado} ${styles[`estado_${usuario.estado}`]}`}>
                          {nombresEstadoUsuario[usuario.estado]}
                        </span>
                        {usuario.motivo_rechazo && <span className={styles.motivo}>Motivo: {usuario.motivo_rechazo}</span>}
                      </div>
                      {puedeGestionar && (
                        <div className={styles.acciones}>
                          {usuario.estado === "pendiente" && puedeAprobar && (
                            <>
                              <button
                                className={styles.primario}
                                type="button"
                                disabled={ocupado === usuario.id}
                                onClick={() => actualizarUsuario(usuario, "aprobar")}
                              >Aprobar</button>
                              <button
                                className={styles.secundario}
                                type="button"
                                disabled={ocupado === usuario.id}
                                onClick={() => actualizarUsuario(usuario, "rechazar")}
                              >Rechazar</button>
                            </>
                          )}
                          {usuario.estado === "aprobado" && (
                            <button
                              className={styles.secundario}
                              type="button"
                              disabled={ocupado === usuario.id}
                              onClick={() => actualizarUsuario(usuario, "desactivar")}
                            >Desactivar cuenta</button>
                          )}
                          {(usuario.estado === "inactivo" || usuario.estado === "rechazado") && (
                            <button
                              className={styles.primario}
                              type="button"
                              disabled={ocupado === usuario.id}
                              onClick={() => actualizarUsuario(usuario, "reactivar")}
                            >Reactivar cuenta</button>
                          )}
                        </div>
                      )}
                      {!puedeGestionar && <p className={styles.soloLectura}>Consulta de cuenta · {usuario.activo ? "activa" : "inactiva"}</p>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className={styles.seccion} aria-labelledby="donaciones-titulo">
            <div className={styles.encabezadoSeccion}>
              <div>
                <h2 id="donaciones-titulo">Seguimiento de donaciones</h2>
                <p>Consulta donaciones disponibles, asignadas, recogidas, entregadas y no completadas.</p>
              </div>
              <div className={styles.filtros}>
                <label>
                  <span>Estado</span>
                  <select
                    value={estadoDonacionFiltro}
                    onChange={(event) => setEstadoDonacionFiltro(event.target.value as EstadoDonacionFiltro)}
                  >
                    <option value="todos">Todos los estados</option>
                    {Object.entries(nombresEstadoDonacion).map(([estado, nombre]) => <option key={estado} value={estado}>{nombre}</option>)}
                  </select>
                </label>
                <label className={styles.archivadas}>
                  <input
                    type="checkbox"
                    checked={mostrarArchivadas}
                    onChange={(event) => setMostrarArchivadas(event.target.checked)}
                  />
                  Mostrar archivadas
                </label>
              </div>
            </div>

            {donacionesFiltradas.length === 0 ? (
              <div className={styles.vacio}>
                <strong>{mostrarArchivadas ? "No hay donaciones archivadas" : "No hay donaciones para mostrar"}</strong>
                <p>Las donaciones archivadas se pueden restaurar; su historial se conserva.</p>
              </div>
            ) : (
              <div className={styles.tarjetas}>
                {donacionesFiltradas.map((donacion) => {
                  const vencida = donacion.estado === "disponible" && new Date(donacion.hora_limite) <= new Date();
                  const archivable = donacion.estado === "entregado" || donacion.estado === "no_completado" || vencida;
                  return (
                    <article key={donacion.id} className={styles.tarjeta}>
                      <div className={styles.donacionCabecera}>
                        <div>
                          <span className={styles.kicker}>{donacion.comercio} · {donacion.origen_aviso === "comercio" ? "Comercio" : "Fundación"}</span>
                          <h3>{donacion.alimento}</h3>
                        </div>
                        <span className={`${styles.estado} ${styles[`rescate_${donacion.estado}`]}`}>
                          {vencida ? "Vencida" : nombresEstadoDonacion[donacion.estado]}
                        </span>
                      </div>
                      <div className={styles.detallesDonacion}>
                        <span><strong>Cantidad:</strong> {donacion.cantidad_aprox}</span>
                        <span><strong>Recogida:</strong> {donacion.lugar_recogida}</span>
                        <span><strong>Límite:</strong> {mostrarFecha(donacion.hora_limite)}</span>
                        <span><strong>Organización:</strong> {donacion.organizacion || "Sin asignar"}</span>
                        <span><strong>Voluntario:</strong> {donacion.voluntario || "Sin asignar"}</span>
                        {donacion.fundacion && <span><strong>Asignada por:</strong> {donacion.fundacion}</span>}
                        {donacion.cantidad_recibida !== null && (
                          <span><strong>Recibido:</strong> {donacion.cantidad_recibida} {donacion.unidad_recibida || ""}</span>
                        )}
                        {donacion.personas_beneficiadas !== null && (
                          <span><strong>Personas beneficiadas:</strong> {donacion.personas_beneficiadas}</span>
                        )}
                        {donacion.motivo_no_completado && (
                          <span className={styles.motivo}><strong>Motivo:</strong> {donacion.motivo_no_completado}</span>
                        )}
                      </div>
                      {mostrarArchivadas ? (
                        <div className={styles.acciones}>
                          <button
                            className={styles.primario}
                            type="button"
                            disabled={ocupado === donacion.id}
                            onClick={() => cambiarArchivo(donacion)}
                          >Restaurar donación</button>
                        </div>
                      ) : (
                        <div className={styles.acciones}>
                          <span className={styles.fechaCreacion}>Creada {mostrarFecha(donacion.creado_en)}</span>
                          {archivable && (
                            <button
                              className={styles.secundario}
                              type="button"
                              disabled={ocupado === donacion.id}
                              onClick={() => cambiarArchivo(donacion)}
                            >Archivar donación</button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
