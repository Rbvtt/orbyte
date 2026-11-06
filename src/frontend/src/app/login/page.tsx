"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api/client";
import { leerToken } from "@/services/api/sesion";
import { sesionApi } from "@/services/api/sesionApi";
import { IconoBrote, IconoFlecha } from "@/components/ui/Iconos";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (leerToken()) {
      router.replace("/home");
    }
  }, [router]);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await sesionApi.login(email, password);
      router.replace("/home");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className={styles.pantalla}>
      <section className={styles.tarjeta} aria-labelledby="titulo-login">
        <div className={styles.marca}>
          <span className={styles.marcaIcono}><IconoBrote tamano={20} /></span>
          <span>Orbyte</span>
        </div>
        <span className={styles.kicker}>Red de rescate alimentario</span>
        <h1 id="titulo-login">Qué bueno tenerte de vuelta.</h1>
        <p className={styles.descripcion}>Inicia sesión para continuar conectando alimentos con quienes más los necesitan.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <form onSubmit={enviar}>
          <label className={styles.campo}>
            Correo electrónico
            <input type="email" autoComplete="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className={styles.campo}>
            Contraseña
            <input type="password" autoComplete="current-password" placeholder="Ingresa tu contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" disabled={enviando}>
            {enviando ? "Ingresando…" : <>Iniciar sesión <IconoFlecha tamano={18} /></>}
          </button>
        </form>
        <div className={styles.pie}>
          <span>¿Aún no tienes cuenta?</span>
          <Link href="/registro">Crear una cuenta</Link>
        </div>
        <p className={styles.mensajeFinal}>Juntos aprovechamos mejor cada alimento.</p>
      </section>
    </main>
  );
}
