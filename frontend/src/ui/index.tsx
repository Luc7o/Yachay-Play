// ============================================================================
// COMPONENTES COMPARTIDOS (sistema de diseño Campus)
// ----------------------------------------------------------------------------
// Toda pantalla nueva o migrada arma su interfaz con estas piezas en vez de
// escribir clases a mano. Los colores salen de ui/tokens.css; los estilos de
// las piezas, de ui/ui.css (y de las clases cp-* de campus.css que reutilizan).
// ============================================================================
import React, { type ComponentType, type ReactNode } from "react";
import { Icono } from "../campusUi";
import "./ui.css";

export { Icono as Icon };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Id de una actividad: le da su color propio (.tono-<id> en tokens.css). */
export type Tono = "ludo" | "crucigrama" | "palabra" | "evaluacion" | "estudio" | "cronometro" | "ruleta" | "pizarra";

// Botón. variant: primary | ghost | quiet | danger | dark · size: sm | lg
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet" | "danger" | "dark";
  size?: "sm" | "lg";
};
export function Button({ variant = "primary", size, className, type = "button", children, ...props }: ButtonProps) {
  return (
    <button type={type} className={cx("cp-btn", variant, size, className)} {...props}>
      {children}
    </button>
  );
}

// Superficie con borde. as: etiqueta HTML (section por defecto).
type CardProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  title?: ReactNode;
  actions?: ReactNode;
};
export function Card({ as: Tag = "section", title, actions, className, children, ...props }: CardProps) {
  return (
    <Tag className={cx("cp-card ui-card", className)} {...props}>
      {(title || actions) && (
        <header className="ui-card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </Tag>
  );
}

// Encabezado de pantalla: antetítulo, título, bajada y acciones a la derecha.
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="cp-pagehead ui-pagehead">
      <div>
        {eyebrow && <span className="cp-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {actions && <div className="ui-pagehead-actions">{actions}</div>}
    </header>
  );
}

// Campo de formulario: etiqueta + control + ayuda. El control va como hijo.
export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("cp-field", className)}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <small className="ui-hint">{hint}</small>}
    </div>
  );
}
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx("cp-input", className)} {...props} />;
});
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("cp-input", className)} {...props}>
      {children}
    </select>
  );
}
export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("cp-input ui-textarea", className)} {...props} />;
}

// Tarjeta de actividad. tono = id de la actividad (color propio, ver tokens.css).
export function Tile({
  icon: Ico,
  title,
  desc,
  cta,
  onClick,
  disabled,
  extra,
  tono,
  className,
}: {
  icon?: ComponentType;
  title: ReactNode;
  desc?: ReactNode;
  cta?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  extra?: ReactNode;
  tono?: Tono | string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx("cp-tile", tono && `tono-${tono}`, className)}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="cp-tile-top">
        <span className="cp-ico">{Ico ? <Ico /> : null}</span>
        {extra}
      </span>
      <strong>{title}</strong>
      {desc && <p>{desc}</p>}
      {cta && <span className="cp-tile-cta">{cta}</span>}
    </button>
  );
}

// Cifra destacada. Dentro de <StatGrid> cada una toma un color distinto.
export function StatCard({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="ui-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export const StatGrid = ({ children }: { children: ReactNode }) => <div className="ui-stats">{children}</div>;

// Etiqueta corta. tone: accent | live | win | warn | lose
export const Chip = ({
  tone,
  className,
  children,
}: {
  tone?: "accent" | "live" | "win" | "warn" | "lose";
  className?: string;
  children: ReactNode;
}) => <span className={cx("cp-chip", tone, className)}>{children}</span>;

// Fila de lista: texto principal + detalle a la izquierda, algo a la derecha, barra opcional.
export function Row({
  title,
  detail,
  end,
  bar,
}: {
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  bar?: ReactNode;
}) {
  return (
    <div className="ui-row">
      <span className="ui-row-main">
        <b>{title}</b>
        {detail && <small>{detail}</small>}
      </span>
      {end}
      {bar}
    </div>
  );
}
// Barra de progreso (0-100). tone: good | mid | bad o un color CSS en `color`.
export const Bar = ({ value, tone, color }: { value: number; tone?: "good" | "mid" | "bad"; color?: string }) => (
  <div className="ui-bar">
    <i className={tone} style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
  </div>
);
export const Dot = ({ color }: { color?: string }) => <i className="ui-dot" style={{ background: color }} />;

// Mensajes: tone ok | error | info. Vacío y cargando.
export const Notice = ({ tone = "info", children }: { tone?: "ok" | "error" | "info"; children?: ReactNode }) =>
  children ? (
    <div className={cx("ui-notice", tone)} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  ) : null;
export const Empty = ({ children }: { children: ReactNode }) => <p className="ui-empty">{children}</p>;
export const Loading = ({ children = "Cargando…" }: { children?: ReactNode }) => (
  <p className="ui-empty" role="status">
    {children}
  </p>
);

// Grillas de dos columnas (se apilan en pantallas angostas).
export const Grid = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx("ui-grid", className)}>{children}</div>
);

// Pestañas: items = [{ id, label }]
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          className={value === it.id ? "on" : ""}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
