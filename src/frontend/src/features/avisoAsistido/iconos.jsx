// Iconos de trazo (24x24) usados por la vista. Son aproximaciones de los iconos del Figma:
// si el equipo de diseño exporta los SVG originales, basta con reemplazarlos aquí.
function Svg({ children, size = 16, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconChevron = ({ className }) => (
  <Svg className={className}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconBuscar = () => (
  <Svg size={14}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Svg>
);
export const IconCalendario = () => (
  <Svg size={13}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Svg>
);
export const IconReloj = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Svg>
);
export const IconPin = () => (
  <Svg>
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="3" />
  </Svg>
);
export const IconInfo = () => (
  <Svg size={16}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </Svg>
);
export const IconAlerta = () => (
  <Svg size={16}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </Svg>
);
export const IconCheck = () => (
  <Svg size={18}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
);
export const IconCircleCheck = () => (
  <Svg size={14}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);
export const IconComercio = () => (
  <Svg>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0" />
    <path d="M5 20v-7.5M19 20v-7.5M5 20h14" />
  </Svg>
);
export const IconBalanza = () => (
  <Svg>
    <path d="M12 3v18M5 21h14M5 7h14" />
    <path d="M5 7l-3 7a3 3 0 006 0L5 7zM19 7l-3 7a3 3 0 006 0l-3-7z" />
  </Svg>
);
export const IconTrigo = () => (
  <Svg>
    <path d="M2 22L16 8" />
    <path d="M3.47 12.53L5 11l1.53 1.53a3.5 3.5 0 010 4.94L5 19l-1.53-1.53a3.5 3.5 0 010-4.94z" />
    <path d="M7.47 8.53L9 7l1.53 1.53a3.5 3.5 0 010 4.94L9 15l-1.53-1.53a3.5 3.5 0 010-4.94z" />
    <path d="M11.47 4.53L13 3l1.53 1.53a3.5 3.5 0 010 4.94L13 11l-1.53-1.53a3.5 3.5 0 010-4.94z" />
    <path d="M20 2h2v2a4 4 0 01-4 4h-2V6a4 4 0 014-4z" />
    <path d="M11.47 17.47L13 19l-1.53 1.53a3.5 3.5 0 01-4.94 0L5 19l1.53-1.53a3.5 3.5 0 014.94 0z" />
    <path d="M16.47 12.47L18 14l-1.53 1.53a3.5 3.5 0 01-4.94 0L10 14l1.53-1.53a3.5 3.5 0 014.94 0z" />
    <path d="M20.47 8.47L22 10l-1.53 1.53a3.5 3.5 0 01-4.94 0L14 10l1.53-1.53a3.5 3.5 0 014.94 0z" />
  </Svg>
);
export const IconAutoria = () => (
  <Svg size={15}>
    <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);
export const IconLogo = () => (
  <Svg size={18}>
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
    <path d="M14.1 6a7 7 0 00-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
  </Svg>
);
