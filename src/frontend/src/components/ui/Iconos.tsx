/** Íconos de trazo de los diseños (#7, #14). Decorativos: el texto de al lado da el significado. */

type Props = { className?: string; tamano?: number };

function Icono({ className, tamano = 20, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconoTienda = (p: Props) => (
  <Icono {...p}>
    <path d="M4 10v9h16v-9" />
    <path d="M3 10l2-5h14l2 5c0 1.4-1.1 2.5-2.5 2.5S16 11.4 16 10c0 1.4-1.1 2.5-2.5 2.5h-3C9.1 12.5 8 11.4 8 10c0 1.4-1.1 2.5-2.5 2.5S3 11.4 3 10z" />
    <path d="M10 19v-4h4v4" />
  </Icono>
);

export const IconoTrigo = (p: Props) => (
  <Icono {...p}>
    <path d="M5 19L19 5" />
    <path d="M9 15c-2 0-3-1-3-3 2 0 3 1 3 3zM9 15c0-2 1-3 3-3 0 2-1 3-3 3zM12 12c-2 0-3-1-3-3 2 0 3 1 3 3zM12 12c0-2 1-3 3-3 0 2-1 3-3 3zM15 9c-2 0-3-1-3-3 2 0 3 1 3 3zM15 9c0-2 1-3 3-3 0 2-1 3-3 3z" />
  </Icono>
);

export const IconoBalanza = (p: Props) => (
  <Icono {...p}>
    <path d="M12 4v16M8 20h8M5 7h14" />
    <path d="M5 7l-3 6c0 1.7 1.3 3 3 3s3-1.3 3-3L5 7zM19 7l-3 6c0 1.7 1.3 3 3 3s3-1.3 3-3l-3-6z" />
  </Icono>
);

export const IconoUbicacion = (p: Props) => (
  <Icono {...p}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icono>
);

export const IconoReloj = (p: Props) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icono>
);

export const IconoCalendario = (p: Props) => (
  <Icono {...p}>
    <rect x="4" y="5.5" width="16" height="14" rx="2" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Icono>
);

export const IconoInfo = (p: Props) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Icono>
);

export const IconoAlerta = (p: Props) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5.5M12 16.2h.01" />
  </Icono>
);

export const IconoCheck = (p: Props) => (
  <Icono {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icono>
);

export const IconoCheckCirculo = (p: Props) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
  </Icono>
);

export const IconoFlecha = (p: Props) => (
  <Icono {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icono>
);

export const IconoMas = (p: Props) => (
  <Icono {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icono>
);

export const IconoBrote = (p: Props) => (
  <Icono {...p}>
    <path d="M12 20v-8" />
    <path d="M12 12c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6zM12 14c0-3 2.2-5.5 6-5.5 0 3-2.2 5.5-6 5.5z" />
  </Icono>
);

export const IconoPersonaCheck = (p: Props) => (
  <Icono {...p}>
    <circle cx="9.5" cy="8" r="3.5" />
    <path d="M3.5 19c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 11.5l1.8 1.8 3.4-3.6" />
  </Icono>
);

export const IconoCamion = (p: Props) => (
  <Icono {...p}>
    <path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Icono>
);

export const IconoXCirculo = (p: Props) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
  </Icono>
);

export const IconoBuscar = (p: Props) => (
  <Icono {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Icono>
);

export const IconoChevron = (p: Props) => (
  <Icono {...p}>
    <path d="M7 10l5 5 5-5" />
  </Icono>
);
