import { cloneElement, isValidElement, useId } from "react";

type Props = {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  opcional?: boolean;
  children: React.ReactElement<Record<string, unknown>>;
};

/** Etiqueta arriba, ayuda debajo y el error junto al campo (CA-01.2: «señala cuál dato falta»). */
export function Field({ etiqueta, ayuda, error, opcional, children }: Props) {
  const id = useId();
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describedBy = [idError, idAyuda].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {etiqueta} {opcional && <span className="field__optional">(opcional)</span>}
      </label>
      {ayuda && (
        <p id={idAyuda} className="field__hint">
          {ayuda}
        </p>
      )}
      {control}
      {error && (
        <p id={idError} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
