/**
 * Datos de ejemplo SOLO para trabajar sin backend (ver services/api/modo.ts).
 * Viven en memoria: al recargar la página vuelven a su estado inicial.
 * TODO(#16, #37, #40, #44, #51): borrar este archivo al conectar las APIs reales.
 */

import type { RescateSeguimiento, UsuarioActual } from "@/types/api";

export const ORGANIZACIONES = {
  siloe: { id: "local-org-1", nombre: "Comedor Comunitario Siloé", direccion: "Cl. 1 Oeste #52-18, Siloé" },
  sanJose: { id: "local-org-2", nombre: "Hogar de Paso San José", direccion: "Cra. 15 #12-60" },
};

export const USUARIOS: UsuarioActual[] = [
  { id: "local-u-1", nombre: "Marcela Ospina", rol: "fundacion", organizacion_id: null, comercio_id: null },
  { id: "local-u-2", nombre: "Andrés Muñoz", rol: "voluntario", organizacion_id: null, comercio_id: null },
  { id: "local-u-3", nombre: "Paola Cuéllar", rol: "voluntario", organizacion_id: null, comercio_id: null },
  { id: "local-u-4", nombre: "Gloria Mina", rol: "organizacion", organizacion_id: ORGANIZACIONES.siloe.id, comercio_id: null },
];

/** Datos que la API real no devuelve en el detalle, pero que el cálculo de impacto necesita. */
export type RescateLocal = RescateSeguimiento & {
  entregado_en: string | null;
  /** Kilogramos recibidos (CA-04.2 permite cantidad estimada: aquí se guarda ya en kg). */
  kg_recibidos: number | null;
};

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

function base(n: number, cambios: Partial<RescateLocal>): RescateLocal {
  const ahora = Date.now();
  return {
    id: `local-${n}`,
    numero: n,
    estado: "disponible",
    pendiente_asignar: false,
    alimento: "Pan del día (mogolla y pan blanco)",
    cantidad_aprox: "2 canastas, unos 15 kg",
    comercio_id: "local-com-1",
    comercio_nombre: "Panadería El Trigal",
    lugar_recogida: "Panadería El Trigal, Cra. 24 #5-31, puerta lateral",
    hora_limite: new Date(ahora + 2 * HORA).toISOString(),
    organizacion_id: null,
    organizacion_nombre: null,
    organizacion_direccion: null,
    voluntario_id: null,
    voluntario_nombre: null,
    creado_en: new Date(ahora - HORA).toISOString(),
    observaciones: null,
    asignado_en: null,
    personas_beneficiadas: null,
    recogido_en: null,
    motivo_no_completado: null,
    entregado_en: null,
    kg_recibidos: null,
    ...cambios,
  };
}

function asignadoA(org: (typeof ORGANIZACIONES)["siloe"], voluntario: UsuarioActual): Partial<RescateLocal> {
  return {
    organizacion_id: org.id,
    organizacion_nombre: org.nombre,
    organizacion_direccion: org.direccion,
    voluntario_id: voluntario.id,
    voluntario_nombre: voluntario.nombre,
    asignado_en: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  };
}

/** Rescates en todos los estados, para recorrer cada caso de #12, #44, #45, #52 y #21. */
export function rescatesIniciales(): RescateLocal[] {
  const [, andres] = USUARIOS;
  const ahora = Date.now();
  return [
    base(101, { estado: "disponible", pendiente_asignar: true, alimento: "Tomate chonto y pimentón", cantidad_aprox: "3 cajas", comercio_nombre: "Frutas y Verduras Doña Carmen", lugar_recogida: "Galería Alameda, local 112" }),
    base(102, { estado: "asignado", ...asignadoA(ORGANIZACIONES.siloe, andres) }),
    base(103, { estado: "recogido", alimento: "Plátano maduro", cantidad_aprox: "1 racimo, unos 20 kg", ...asignadoA(ORGANIZACIONES.siloe, andres), recogido_en: new Date(ahora - 10 * 60 * 1000).toISOString() }),
    base(104, { estado: "entregado", alimento: "Yogur y kumis", cantidad_aprox: "24 unidades de 1 L", ...asignadoA(ORGANIZACIONES.siloe, andres), entregado_en: new Date(ahora - 2 * DIA).toISOString(), kg_recibidos: 24, personas_beneficiadas: 40 }),
    base(105, { estado: "entregado", alimento: "Pan del día", ...asignadoA(ORGANIZACIONES.sanJose, andres), entregado_en: new Date(ahora - 3 * DIA).toISOString(), kg_recibidos: 15.5, personas_beneficiadas: 25 }),
    base(106, { estado: "no_completado", alimento: "Arroz y lenteja", cantidad_aprox: "5 bolsas", motivo_no_completado: "El comercio cerró antes de la hora límite." }),
  ];
}
