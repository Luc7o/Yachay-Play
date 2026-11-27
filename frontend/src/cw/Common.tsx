import type { ReactNode } from "react";
// Piezas compartidas del Crucigrama — diseño "Campus" (mismas que la configuración de Ludo).
export const Step = ({ n, t, d }) => (
  <div className="cfg2-howstep">
    <b>{n}</b>
    <div>
      <strong>{t}</strong>
      <p>{d}</p>
    </div>
  </div>
);

// Grupo de botones para elegir un valor
export function Options<T extends string | number>({
  value,
  options,
  onChange,
  format,
  label,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  format?: (v: T) => ReactNode;
  label?: string;
}) {
  return (
    <div className="cp-opts" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o}
          role="radio"
          aria-checked={o === value}
          className={o === value ? "on" : ""}
          onClick={() => onChange(o)}
        >
          {format ? format(o) : o}
        </button>
      ))}
    </div>
  );
}
