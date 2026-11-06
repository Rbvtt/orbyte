import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { TopNavigation } from "@/components/ui/AccionesSesion";
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
        <Suspense fallback={null}>
          <TopNavigation />
        </Suspense>
        <main id="contenido">{children}</main>
      </body>
    </html>
  );
}
