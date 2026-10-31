"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/api/client";
import { sesionApi } from "@/services/api/sesionApi";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const usuario = await sesionApi.login(email, password);
      router.replace(usuario.rol === "fundacion" ? "/fundacion/rescates" : "/aviso/nuevo");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className={styles.pantalla}>
      <section className={styles.tarjeta} aria-labelledby="titulo-login">
        <p className={styles.marca}>Mesa común</p>
        <h1 id="titulo-login">Iniciar sesión</h1>
        <p className={styles.descripcion}>Accede para registrar y coordinar rescates de alimentos.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <form onSubmit={enviar}>
          <label>
            Correo electrónico
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Contraseña
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button type="submit" disabled={enviando}>{enviando ? "Ingresando…" : "Ingresar"}</button>
        </form>
      </section>
    </main>
  );
}
