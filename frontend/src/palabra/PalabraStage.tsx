import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./palabraFit.css";
import type { ReactNode } from "react";
import type { SinTipo } from "../tipos";

// ============================================================================
// PANTALLA DE JUEGO DE PALABRA RELÁMPAGO (Individual y En línea)
// ============================================================================
// Ocupa TODA la ventana (se dibuja encima de la app) y se adapta a su tamaño:
// letras + reloj + respuesta al centro, y a un lado el marcador y la lista de
// palabras usadas, que se desplaza por dentro. Nunca hay que bajar la página.
// ============================================================================

// Tema claro/oscuro compartido con el resto de la app (data-theme en <html>).
export function useStageTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "dark");
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem("yp_theme", next);
    } catch {
      /* almacenamiento opcional */
    }
    setTheme(next);
  };
  return [theme, toggle] as const;
}

export const Hearts = ({ lives, max = 3 }: { lives: number; max?: number }) => (
  <span className="pf-hearts" aria-label={`${lives} de ${max} vidas`}>
    {"♥".repeat(Math.max(0, lives))}
    <span className="pf-hearts-off">{"♥".repeat(Math.max(0, max - lives))}</span>
  </span>
);

// Marco: barra superior + contenido, a pantalla completa y sin que la página se desplace.
type Marco = {
  theme: string;
  onToggleTheme: () => void;
  onExit: () => void;
  exitLabel?: string;
  title: string;
  kicker?: string;
};

export function StageFrame({
  theme,
  onToggleTheme,
  onExit,
  exitLabel = "Salir",
  title,
  kicker,
  children,
}: Marco & { children?: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return createPortal(
    <div className={"pf-stage " + (theme === "dark" ? "pf-night" : "pf-day")} role="region" aria-label={title}>
      <header className="pf-bar">
        <div className="pf-bar-title">
          {kicker && <span className="pf-kicker">{kicker}</span>}
          <strong>{title}</strong>
        </div>
        <div className="pf-bar-actions">
          <button
            type="button"
            className="pf-chip-btn"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button type="button" className="pf-chip-btn" onClick={onExit}>
            {exitLabel}
          </button>
        </div>
      </header>
      {children}
    </div>,
    document.body,
  );
}

// Reloj: anillo que se vacía + segundos en el centro.
export function Clock({ remain, total, low, boom }) {
  const C = 2 * Math.PI * 44;
  const p = Math.max(0, Math.min(1, total ? remain / total : 0));
  return (
    <div
      className={"pf-clock" + (low ? " pf-low" : "") + (boom ? " pf-boom" : "")}
      role="timer"
      aria-label={`${remain} segundos`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="pf-ring-track" cx="50" cy="50" r="44" />
        <circle
          className="pf-ring"
          cx="50"
          cy="50"
          r="44"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="pf-clock-in">
        <span className="pf-clock-ico" aria-hidden="true">
          💣
        </span>
        <b>{remain}</b>
      </div>
    </div>
  );
}

// Palabras usadas: las más recientes primero, así lo último que se usó se ve sin desplazarse.
export function UsedList({ items, title = "Palabras usadas" }) {
  return (
    <section className="pf-used" aria-label={title}>
      <h3>
        {title} <span>{items.length}</span>
      </h3>
      <div className="pf-used-list">
        {items.length === 0 ? (
          <p className="pf-empty">Todavía ninguna</p>
        ) : (
          items.map((it, i) => (
            <span
              key={(it.word || it) + i}
              className="pf-word"
              style={it.color ? { "--w": it.color } : undefined}
              title={it.by ? `${it.by}` : undefined}
            >
              {it.word || it}
            </span>
          ))
        )}
      </div>
    </section>
  );
}

// Pantalla de juego completa.
export function PalabraStage({
  theme,
  onToggleTheme,
  onExit,
  exitLabel,
  title,
  kicker,
  status,
  fragment,
  clock,
  entry,
  message,
  actions,
  side,
  used,
  usedTitle,
}: Marco & {
  status?: ReactNode;
  /** letras que debe contener la palabra */
  fragment: string;
  /** reloj del turno: { remain, total, low, boom } */
  clock: SinTipo;
  /** campo de respuesta: { value, onChange, onSubmit, editable, inputRef, disabled, placeholder } */
  entry: SinTipo;
  message?: SinTipo;
  actions?: ReactNode;
  side?: ReactNode;
  used?: string[];
  usedTitle?: string;
}) {
  return (
    <StageFrame
      theme={theme}
      onToggleTheme={onToggleTheme}
      onExit={onExit}
      exitLabel={exitLabel}
      title={title}
      kicker={kicker}
    >
      <div className="pf-body">
        <main className="pf-main" onClick={() => entry?.inputRef?.current?.focus()}>
          <div className="pf-status">{status}</div>
          <div className="pf-fragment" aria-label={`Letras: ${fragment}`}>
            {fragment.toUpperCase()}
          </div>
          <Clock {...clock} />
          <form
            className="pf-entry"
            onSubmit={(e) => {
              e.preventDefault();
              entry.onSubmit?.();
            }}
          >
            {entry.editable ? (
              <input
                ref={entry.inputRef}
                value={entry.value}
                onChange={(e) => entry.onChange(e.target.value)}
                disabled={entry.disabled}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                maxLength={35}
                placeholder={entry.placeholder || "Escribe una palabra y pulsa Enter"}
                aria-label="Escribe una palabra y pulsa Enter para enviarla"
              />
            ) : (
              <div className="pf-typed" aria-live="polite">
                {entry.value || entry.placeholder || "…"}
              </div>
            )}
          </form>
          <div className={"pf-msg" + (message?.tone ? " pf-" + message.tone : "")} role="status" aria-live="polite">
            {message?.text || "\u00A0"}
          </div>
          <div className="pf-actions">{actions}</div>
        </main>
        <aside className="pf-side">
          <section className="pf-score">{side}</section>
          <UsedList items={used} title={usedTitle} />
        </aside>
      </div>
    </StageFrame>
  );
}
