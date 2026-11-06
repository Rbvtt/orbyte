"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api/client";
import { leerToken } from "@/services/api/sesion";
import { useAhora } from "@/features/rescates/useAhora";
import { rescatesApi } from "@/services/api/rescates";
import { sesionApi } from "@/services/api/sesionApi";
import {
  aLocalBogota,
  primerCampoConError,
  validarAviso,
  type FormularioAviso,
} from "@/features/avisos/validacion";
import type { RescateAvisoComercio } from "@/types/rescates";
import styles from "./editar.module.css";

type DatosEdicion = Pick<FormularioAviso, "alimento" | "cantidad_aprox" | "lugar_recogida" | "hora_limite" | "observaciones">;

const CAMPOS_REQUERIDOS = [
  { campo: "alimento", etiqueta: "Alimento" },
  { campo: "cantidad_aprox", etiqueta: "Cantidad aproximada" },
  { campo: "lugar_recogida", etiqueta: "Lugar de recogida" },
] as const satisfies ReadonlyArray<{ campo: "alimento" | "cantidad_aprox" | "lugar_recogida"; etiqueta: string }>;

export default function EditarAvisoComercioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [aviso, setAviso] = useState<RescateAvisoComercio | null>(null);
  const [form, setForm] = useState<DatosEdicion>({
    alimento: "",
    cantidad_aprox: "",
    lugar_recogida: "",
    hora_limite: "",
    observaciones: "",
  });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const ahora = useAhora();
  const bogotaNow = aLocalBogota(ahora);
  const fechaMinima = bogotaNow.slice(0, 10);
  const fechaMaxima = `${bogotaNow.slice(0, 4)}-12-31`;

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
        const avisos = await rescatesApi.misAvisos();
        const actual = avisos.find((item) => item.id === id);
        if (!activo) return;
        if (!actual) {
          setError("No encontramos este aviso en las donaciones de tu comercio.");
          return;
        }
        setAviso(actual);
        setForm({
          alimento: actual.alimento,
          cantidad_aprox: actual.cantidad_aprox,
          lugar_recogida: actual.lugar_recogida,
          hora_limite: aLocalBogota(new Date(actual.hora_limite)),
          observaciones: actual.observaciones ?? "",
        });
      } catch (reason) {
        if (!activo) return;
        if (reason instanceof ApiError && reason.status === 401) {
          router.replace("/login");
          return;
        }
        setError(reason instanceof Error ? reason.message : "No se pudo cargar el aviso.");
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => {
      activo = false;
    };
  }, [id, router]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const errores = validarAviso(
      { ...form, comercio: "" },
      ahora,
      false,
    );
    const primero = primerCampoConError(errores);
    if (primero) {
      setError(errores[primero] ?? "Revisa los datos del aviso.");
      return;
    }
    setGuardando(true);
    try {
      await rescatesApi.actualizarAviso(id, {
        alimento: form.alimento.trim(),
        cantidad_aprox: form.cantidad_aprox.trim(),
        lugar_recogida: form.lugar_recogida.trim(),
        hora_limite: `${form.hora_limite.slice(0, 16)}:00-05:00`,
        observaciones: form.observaciones.trim() || null,
      });
      router.push("/comercio/avisos");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "No se pudo guardar el aviso.");
    } finally {
      setGuardando(false);
    }
  }

  const disponible = aviso?.estado === "disponible" && Date.parse(aviso.hora_limite) > ahora.getTime();

  if (cargando) {
    return <main className={styles.pagina}><p className={styles.estado}>Cargando aviso…</p></main>;
  }

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <Link href="/comercio/avisos" className={styles.volver}>← Volver a mis avisos</Link>
        <section className={styles.tarjeta}>
          <span className={styles.kicker}>Donaciones de mi comercio</span>
          <h1>Editar aviso</h1>
          <p className={styles.descripcion}>Puedes actualizar los datos mientras el aviso siga disponible y no haya vencido.</p>

          {error && <div className={styles.error} role="alert">{error}</div>}

          {aviso && !disponible ? (
            <div className={styles.aviso}>Este aviso ya no se puede editar porque fue asignado, finalizado o venció.</div>
          ) : aviso && (
            <form className={styles.formulario} onSubmit={guardar}>
              {CAMPOS_REQUERIDOS.map(({ campo, etiqueta }) => (
                <label key={campo}>
                  {etiqueta}
                  <input
                    value={form[campo]}
                    onChange={(event) => setForm((actual) => ({ ...actual, [campo]: event.target.value }))}
                    required
                  />
                </label>
              ))}

              <label>
                Fecha límite
                <input
                  type="date"
                  value={form.hora_limite.slice(0, 10)}
                  min={fechaMinima}
                  max={fechaMaxima}
                  onChange={(event) => setForm((actual) => ({
                    ...actual,
                    hora_limite: `${event.target.value}T${actual.hora_limite.slice(11, 16)}`,
                  }))}
                  required
                />
              </label>

              <label>
                Hora límite
                <input
                  type="time"
                  value={form.hora_limite.slice(11, 16)}
                  onChange={(event) => setForm((actual) => ({
                    ...actual,
                    hora_limite: `${actual.hora_limite.slice(0, 10)}T${event.target.value}`,
                  }))}
                  required
                />
              </label>

              <label>
                Observaciones
                <textarea
                  value={form.observaciones}
                  onChange={(event) => setForm((actual) => ({ ...actual, observaciones: event.target.value }))}
                  rows={3}
                />
              </label>

              <button type="submit" disabled={guardando}>
                {guardando ? "Guardando cambios…" : "Guardar cambios"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
