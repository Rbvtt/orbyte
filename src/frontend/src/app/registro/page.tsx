"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/services/api/client";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";
import type { RolUsuario } from "@/types/api";
import { IconoBrote, IconoCheck } from "@/components/ui/Iconos";
import styles from "./registro.module.css";

const ROLES: Array<{ value: RolUsuario; label: string }> = [
  { value: "voluntario", label: "Voluntario" },
  { value: "organizacion", label: "Organización receptora" },
  { value: "comercio", label: "Comercio" },
  { value: "fundacion", label: "Fundación" },
];

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "voluntario" as RolUsuario,
    direccion: "",
    telefono: "",
    medio_transporte: "",
    disponibilidad: "",
  });
  const [error, setError] = useState("");
  const [registroCompletado, setRegistroCompletado] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (leerToken()) {
      router.replace("/home");
    }
  }, [router]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const respuesta = await sesionApi.register({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        rol: form.rol,
        direccion: form.direccion || undefined,
        telefono: form.telefono || undefined,
        medio_transporte: form.medio_transporte || undefined,
        disponibilidad: form.disponibilidad || undefined,
      });
      setRegistroCompletado(respuesta.aprobado);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "No se pudo completar el registro.");
    } finally {
      setEnviando(false);
    }
  }

  const requiereDireccion = form.rol === "comercio" || form.rol === "organizacion";

  return (
    <main className={styles.pantalla}>
      <section className={styles.tarjeta}>
        <div className={styles.marca}>
          <span className={styles.marcaIcono}><IconoBrote tamano={20} /></span>
          <span>Orbyte</span>
        </div>
        {registroCompletado === null && (
          <>
            <span className={styles.kicker}>Súmate a la red</span>
            <h1>Crear una cuenta</h1>
            <p className={styles.descripcion}>
              Cuéntanos un poco sobre ti para conectar tu perfil con la red de rescate.
            </p>
          </>
        )}

        {registroCompletado !== null ? (
          <section className={styles.confirmacion} role="status" aria-live="polite">
            <div className={styles.confirmacionIcono}>
              <IconoCheck tamano={36} />
            </div>
            <span className={styles.confirmacionEtiqueta}>Registro exitoso</span>
            <h2>{registroCompletado ? "¡Tu cuenta está lista!" : "¡Recibimos tu registro!"}</h2>
            <p>
              {registroCompletado
                ? "Tu cuenta está activa. Ya puedes iniciar sesión y sumarte a la red de rescate."
                : `La activación de tu cuenta está pendiente de aprobación por ${form.rol === "fundacion" ? "el equipo administrador" : "la fundación"}. El proceso puede tardar entre 10 minutos y 24 horas.`}
            </p>
            <Link className={styles.botonConfirmacion} href="/login">
              Ir a iniciar sesión
            </Link>
            {!registroCompletado && (
              <p className={styles.notaConfirmacion}>
                Intenta iniciar sesión más tarde, cuando la fundación haya aprobado tu cuenta.
              </p>
            )}
          </section>
        ) : (
          <>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <form className={styles.formulario} onSubmit={enviar}>
              <label className={styles.campo}>
                <span>Nombre</span>
                <input
                  className="input"
                  autoComplete="name"
                  placeholder="Tu nombre o el de tu organización"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </label>

              <label className={styles.campo}>
                <span>Correo electrónico</span>
                <input
                  type="email"
                  className="input"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </label>

              <label className={styles.campo}>
                <span>Contraseña</span>
                <input
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  placeholder="Al menos 8 caracteres"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  minLength={8}
                  required
                />
              </label>

              <label className={styles.campo}>
                <span>Tipo de cuenta</span>
                <select
                  className="select"
                  value={form.rol}
                  onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as RolUsuario }))}
                >
                  {ROLES.map((rol) => (
                    <option key={rol.value} value={rol.value}>
                      {rol.label}
                    </option>
                  ))}
                </select>
              </label>

              {requiereDireccion && (
                <label className={styles.campo}>
                  <span>Dirección</span>
                  <input
                    className="input"
                    autoComplete="street-address"
                    placeholder="Dirección principal"
                    value={form.direccion}
                    onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                    required
                  />
                </label>
              )}

              <label className={styles.campo}>
                <span>Teléfono</span>
                <input
                  type="tel"
                  className="input"
                  autoComplete="tel"
                  placeholder="Opcional"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </label>

              {form.rol === "voluntario" && (
                <>
                  <label className={styles.campo}>
                    <span>Medio de transporte</span>
                    <input
                      className="input"
                      placeholder="Ej. bicicleta, automóvil"
                      value={form.medio_transporte}
                      onChange={(e) => setForm((f) => ({ ...f, medio_transporte: e.target.value }))}
                    />
                  </label>
                  <label className={styles.campo}>
                    <span>Disponibilidad</span>
                    <input
                      className="input"
                      placeholder="Ej. fines de semana"
                      value={form.disponibilidad}
                      onChange={(e) => setForm((f) => ({ ...f, disponibilidad: e.target.value }))}
                    />
                  </label>
                </>
              )}

              <button type="submit" className="btn btn--primary" disabled={enviando}>
                {enviando ? "Creando cuenta…" : "Crear cuenta"}
              </button>
            </form>

            <p className={styles.pie}>
              <Link href="/login">Volver a iniciar sesión</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
