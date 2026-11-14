"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconoBalanza,
  IconoCamion,
  IconoFlecha,
  IconoPersonaCheck,
  IconoTienda,
  IconoTrigo,
} from "@/components/ui/Iconos";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";
import type { RolUsuario, UsuarioSesion } from "@/types/api";
import styles from "./home.module.css";

type Accion = {
  titulo: string;
  descripcion: string;
  href: string;
  icono: typeof IconoTienda;
  etiqueta: string;
};

type VistaRol = {
  nombre: string;
  saludo: string;
  descripcion: string;
  enfoque: string;
  acciones: Accion[];
  notaTitulo: string;
  nota: string;
};

const VISTAS: Record<RolUsuario, VistaRol> = {
  administrador: {
    nombre: "Administración",
    saludo: "Supervisa cada parte de la red desde un solo lugar.",
    descripcion: "Gestiona cuentas por rol y estado, y da seguimiento a todas las donaciones.",
    enfoque: "Control de la plataforma",
    acciones: [
      {
        titulo: "Abrir administración",
        descripcion: "Gestiona usuarios y revisa donaciones en cada etapa.",
        href: "/admin",
        icono: IconoPersonaCheck,
        etiqueta: "Panel de control",
      },
    ],
    notaTitulo: "Tu alcance",
    nota: "Puedes administrar todas las cuentas no administrativas y archivar donaciones finalizadas o vencidas sin borrar su historial.",
  },
  fundacion: {
    nombre: "Fundación",
    saludo: "Coordina cada rescate y conecta la ayuda con quien la necesita.",
    descripcion: "Administra la operación de alimentos donados, desde el aviso hasta la coordinación de la entrega.",
    enfoque: "Coordinación de rescates",
    acciones: [
      {
        titulo: "Ver rescates activos",
        descripcion: "Supervisa estados, prioridades y asignaciones de la jornada.",
        href: "/fundacion/rescates",
        icono: IconoCamion,
        etiqueta: "Operación",
      },
      {
        titulo: "Registrar un aviso",
        descripcion: "Registra una donación recibida por llamada u otro medio.",
        href: "/aviso/nuevo",
        icono: IconoTrigo,
        etiqueta: "Nueva donación",
      },
      {
        titulo: "Gestionar comercios",
        descripcion: "Revisa comercios registrados y aprueba, desactiva o reactiva sus cuentas.",
        href: "/fundacion/comercios",
        icono: IconoTienda,
        etiqueta: "Cuentas de comercios",
      },
    ],
    notaTitulo: "Cada aviso cuenta",
    nota: "Registra la información del alimento y su hora límite para que el equipo pueda coordinar su rescate a tiempo.",
  },
  comercio: {
    nombre: "Comercio",
    saludo: "Tus alimentos pueden convertirse en una gran oportunidad.",
    descripcion: "Publica los alimentos disponibles y ayuda a que lleguen a una organización de tu comunidad.",
    enfoque: "Donaciones de mi comercio",
    acciones: [
      {
        titulo: "Publicar alimentos",
        descripcion: "Registra una donación disponible para coordinar su recogida.",
        href: "/aviso/nuevo",
        icono: IconoTienda,
        etiqueta: "Crear aviso",
      },
      {
        titulo: "Gestionar mis avisos",
        descripcion: "Consulta el estado de tus donaciones y edita o cancela las que siguen disponibles.",
        href: "/comercio/avisos",
        icono: IconoTrigo,
        etiqueta: "Mis donaciones",
      },
    ],
    notaTitulo: "Antes de publicar",
    nota: "Ten a mano la cantidad, el lugar de recogida y la hora límite. Estos datos ayudan a coordinar el rescate.",
  },
  voluntario: {
    nombre: "Voluntariado",
    saludo: "Tu tiempo puede hacer que una donación llegue más lejos.",
    descripcion: "Aquí encontrarás la información relacionada con tu participación en la red de rescate.",
    enfoque: "Mi participación",
    acciones: [
      {
        titulo: "Mis rescates asignados",
        descripcion: "Consulta las recogidas que la Fundación te asignó y sus horarios.",
        href: "/mis-rescates",
        icono: IconoCamion,
        etiqueta: "Mis asignaciones",
      },
    ],
    notaTitulo: "Tu recorrido",
    nota: "Entra a «Mis rescates asignados» para revisar las direcciones de recogida y entrega y marcar la donación cuando la entregues.",
  },
  organizacion: {
    nombre: "Organización receptora",
    saludo: "Recibir alimentos también transforma comunidades.",
    descripcion: "Este espacio está pensado para acompañar a tu organización en la recepción de donaciones.",
    enfoque: "Recepción de alimentos",
    acciones: [
      {
        titulo: "Mis rescates asignados",
        descripcion: "Consulta las donaciones que la Fundación asignó para recibir en tu organización.",
        href: "/mis-rescates",
        icono: IconoTrigo,
        etiqueta: "Recepciones",
      },
    ],
    notaTitulo: "Tu recorrido",
    nota: "Entra a «Mis rescates asignados» para identificar el comercio, la Fundación y el voluntario; confirma la recepción cuando llegue la donación.",
  },
};

export default function HomePage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);

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
        if (activo) setUsuario(actual);
      })
      .catch(() => router.replace("/login"));

    return () => {
      activo = false;
    };
  }, [router]);

  if (!usuario) {
    return (
      <main className={styles.cargando}>
        <div className={styles.cargandoMarca} aria-hidden="true">
          <IconoBalanza tamano={24} />
        </div>
        <p role="status">Preparando tu espacio…</p>
      </main>
    );
  }

  const vista = VISTAS[usuario.rol];

  return (
    <main className={styles.pagina}>
      <div className={styles.dashboard}>
        <div className={styles.migas}>
          <span>Orbyte</span>
          <span aria-hidden="true">/</span>
          <span>{vista.nombre}</span>
        </div>

        <section className={styles.hero}>
          <div className={styles.heroContenido}>
            <p className={styles.etiqueta}>
              <span className={styles.punto} />
              {vista.enfoque}
            </p>
            <p className={styles.saludo}>Hola, {usuario.nombre}</p>
            <h1>{vista.saludo}</h1>
            <p className={styles.descripcion}>{vista.descripcion}</p>
          </div>
          <div className={styles.heroArte} aria-hidden="true">
            <div className={styles.aroGrande} />
            <div className={styles.aroPequeno} />
            <div className={styles.arteIcono}>
              {usuario.rol === "administrador" ? (
                <IconoPersonaCheck tamano={44} />
              ) : usuario.rol === "fundacion" ? (
                <IconoBalanza tamano={44} />
              ) : usuario.rol === "comercio" ? (
                <IconoTienda tamano={44} />
              ) : usuario.rol === "voluntario" ? (
                <IconoCamion tamano={44} />
              ) : (
                <IconoTrigo tamano={44} />
              )}
            </div>
            <span className={styles.artePunto} />
          </div>
        </section>

        <section className={styles.seccionAcciones} aria-labelledby="acciones-titulo">
          <div className={styles.encabezadoSeccion}>
            <div>
              <span className={styles.sobrelinea}>Tu espacio de trabajo</span>
              <h2 id="acciones-titulo">¿Qué necesitas hacer?</h2>
            </div>
            <span className={styles.rolPill}>{vista.nombre}</span>
          </div>

          {vista.acciones.length > 0 ? (
            <div className={`${styles.tarjetas} ${vista.acciones.length === 1 ? styles.tarjetasUna : ""}`}>
              {vista.acciones.map((accion) => {
                const Icono = accion.icono;
                return (
                  <Link key={accion.href} href={accion.href} className={styles.tarjeta}>
                    <span className={styles.tarjetaIcono}>
                      <Icono tamano={23} />
                    </span>
                    <span className={styles.tarjetaTexto}>
                      <span className={styles.tarjetaEtiqueta}>{accion.etiqueta}</span>
                      <strong>{accion.titulo}</strong>
                      <span>{accion.descripcion}</span>
                    </span>
                    <span className={styles.tarjetaFlecha} aria-hidden="true">
                      <IconoFlecha tamano={18} />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.estadoVacio}>
              <div className={styles.estadoIcono} aria-hidden="true">
                {usuario.rol === "voluntario" ? <IconoCamion tamano={24} /> : <IconoTrigo tamano={24} />}
              </div>
              <div>
                <strong>{usuario.rol === "voluntario" ? "Aún no tienes rescates asignados" : "Aún no tienes entregas asignadas"}</strong>
                <p>Cuando haya una asignación para ti, la información aparecerá en este espacio.</p>
              </div>
            </div>
          )}
        </section>

        <aside className={styles.nota}>
          <div className={styles.notaMarca} aria-hidden="true">
            <IconoBalanza tamano={20} />
          </div>
          <div>
            <strong>{vista.notaTitulo}</strong>
            <p>{vista.nota}</p>
          </div>
          <span className={styles.notaDecoracion} aria-hidden="true">ORBYTE · RED SOLIDARIA</span>
        </aside>

        <footer className={styles.pie}>
          <span>Orbyte</span>
          <span>Rescatamos alimentos, conectamos personas.</span>
        </footer>
      </div>
    </main>
  );
}
