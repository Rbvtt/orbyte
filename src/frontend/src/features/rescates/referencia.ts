/** Referencia corta para hablar del rescate (el diseño usa «R-1048»). */
export function referencia(id: string): string {
  return `R-${id.slice(0, 4).toUpperCase()}`;
}
