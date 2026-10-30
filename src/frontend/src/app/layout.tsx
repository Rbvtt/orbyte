import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Red de Rescate · Fundación Mesa Común",
    template: "%s · Red de Rescate",
  },
  description: "Coordinación de rescates de alimentos de la Fundación Mesa Común.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO">
      <body>
        <a href="#contenido" className="sr-only">
          Saltar al contenido
        </a>
        <main id="contenido">{children}</main>
      </body>
    </html>
  );
}
