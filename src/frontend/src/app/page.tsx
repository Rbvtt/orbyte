import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

const pasos = [
  {
    titulo: "1. Publica la disponibilidad",
    texto: "Los comercios registran alimentos próximos a vencer para que la red pueda gestionarlos rápidamente.",
  },
  {
    titulo: "2. Coordina la entrega",
    texto: "La fundación asigna organizaciones y voluntarios para organizar recogidas y rutas inteligentes.",
  },
  {
    titulo: "3. Reduce desperdicio",
    texto: "Los alimentos llegan a quienes más los necesitan y se evita que se tiren cuando aún tienen valor.",
  },
];

const impacto = [
  { valor: "+1.000", texto: "donaciones coordinadas con la red" },
  { valor: "-40%", texto: "de desperdicio de alimentos en la cadena" },
  { valor: "24/7", texto: "operación de apoyo y coordinación" },
];

export default function PaginaPrincipal() {
  return (
    <div className={styles.shell}>
      <header className={styles.navbar}>
        <div className={styles.brandWrap}>
          <Image src="/orbyte-logo.png" alt="Logo Orbyte" width={190} height={80} className={styles.brandLogo} priority />
        </div>

        <nav className={styles.nav} aria-label="Navegación principal">
          <Link href="#como-funciona">Cómo funciona</Link>
          <Link href="#impacto">Impacto</Link>
          <Link href="#nosotros">Nosotros</Link>
        </nav>

        <div className={styles.navActions}>
          <Link href="/login" className={styles.linkButton}>Iniciar sesión</Link>
          <Link href="/registro" className={styles.primaryButton}>Registrarse</Link>
        </div>
      </header>

      <main>
        <section className={styles.heroSection}>
          <div className={styles.heroCopy}>
            <div className={styles.logoLockup}>
              <Image src="/orbyte-logo.png" alt="Logo Orbyte" width={240} height={100} className={styles.heroLogo} priority />
            </div>
            <span className={styles.eyebrow}>Plataforma de rescate alimentario</span>
            <h1>
              ¡Bienvenido a <span>Orbyte</span>!
            </h1>
            <p className={styles.heroText}>
              Rescatamos alimentos, conectamos personas y transformamos oportunidades para construir una
              comunidad más solidaria y sostenible.
            </p>

            <div className={styles.heroActions}>
              <Link href="/registro" className={styles.primaryButtonLarge}>Registrarse</Link>
              <Link href="/login" className={styles.secondaryButtonLarge}>Iniciar sesión</Link>
            </div>

            <div className={styles.shortStats}>
              <div>
                <strong>3.200+</strong>
                <span>kg recuperados</span>
              </div>
              <div>
                <strong>120</strong>
                <span>voluntarios activos</span>
              </div>
              <div>
                <strong>28</strong>
                <span>comercios conectados</span>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual} aria-label="Ilustración de rescate de alimentos">
            <div className={styles.cardMain}>
              <div className={styles.visualBadge}>Rescate activo</div>
              <div className={styles.visualGrid}>
                <div className={styles.iconTile}>
                  <span className={styles.iconFood}>🥬</span>
                  <small>Verduras</small>
                </div>
                <div className={styles.iconTile}>
                  <span className={styles.iconFood}>🥖</span>
                  <small>Pan</small>
                </div>
                <div className={styles.iconTile}>
                  <span className={styles.iconFood}>🍅</span>
                  <small>Frutas</small>
                </div>
                <div className={styles.iconTile}>
                  <span className={styles.iconFood}>🥛</span>
                  <small>Lácteos</small>
                </div>
              </div>
            </div>

            <div className={styles.floatingCardUpper}>
              <span>48 entregas hoy</span>
              <strong>+96% de impacto</strong>
            </div>

            <div className={styles.floatingCardLower}>
              <div className={styles.spark}></div>
              <div>
                <small>Red solidaria</small>
                <strong>Conectando a la comunidad</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.infoSection} id="como-funciona">
          <div className={styles.sectionHeader}>
            <span className={styles.kicker}>Cómo funciona</span>
            <h2>Una red simple, rápida y efectiva</h2>
          </div>

          <div className={styles.stepsGrid}>
            {pasos.map((paso) => (
              <article key={paso.titulo} className={styles.stepCard}>
                <div className={styles.stepIndex}>{paso.titulo.split(".")[0]}</div>
                <h3>{paso.titulo.replace(/^\d+\.\s*/, "")}</h3>
                <p>{paso.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.impactSection} id="impacto">
          <div className={styles.sectionHeader}>
            <span className={styles.kicker}>Impacto real</span>
            <h2>Menos desperdicio, más oportunidades</h2>
          </div>

          <div className={styles.impactGrid}>
            {impacto.map((item) => (
              <article key={item.valor} className={styles.impactCard}>
                <strong>{item.valor}</strong>
                <span>{item.texto}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.storySection} id="nosotros">
          <div className={styles.storyText}>
            <span className={styles.kicker}>Nuestra misión</span>
            <h2>Construimos una red para transformar excedentes en apoyo.</h2>
            <p>
              Orbyte conecta comercios con fundaciones, organizaciones y voluntarios para coordinar rescates
              de alimentos de forma ágil, transparente y humana. Cada donación cuenta: ayuda a reducir el
              desperdicio, apoya a personas en situación vulnerable y fortalece comunidades enteras.
            </p>
          </div>

          <div className={styles.storyPanel}>
            <div className={styles.metricRow}>
              <span>Alimentos recuperados</span>
              <strong>87%</strong>
            </div>
            <div className={styles.metricRow}>
              <span>Tiempo promedio de coordinación</span>
              <strong>2h</strong>
            </div>
            <div className={styles.metricRow}>
              <span>Personas impactadas</span>
              <strong>1.8k</strong>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <div className={styles.brandName}>Orbyte</div>
          <p>Rescatamos alimentos, conectamos personas y transformamos oportunidades.</p>
        </div>

        <div className={styles.footerLinks}>
          <Link href="/login">Iniciar sesión</Link>
          <Link href="/registro">Registrarse</Link>
          <Link href="#impacto">Impacto</Link>
        </div>
      </footer>
    </div>
  );
}
