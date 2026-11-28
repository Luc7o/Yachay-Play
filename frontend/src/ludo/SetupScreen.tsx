import { COLORS, TURN_ORDER } from "../constants";
import { Button } from "../ui";
import type { ReactNode } from "react";
import type { SinTipo } from "../tipos";

// ============================================================================
// LUDO · CREAR PARTIDA (docente) — diseño "Campus" (ver campusJuegos.css, "cfg2")
// Se muestra dentro del menú de la app (AppShell), así que no lleva barra propia.
// Props sin cambios: gameName, counts, minutes, answerSeconds, rollSeconds (y sus
// setters), createGame, setupError, creating, goHome.
// ============================================================================

// Grupo de botones para elegir un valor (reemplaza a las listas desplegables)
export function Chips<T extends string | number>({
  value,
  options,
  onChange,
  format,
  small,
  label,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  format?: (v: T) => ReactNode;
  small?: boolean;
  label?: string;
}) {
  return (
    <div className={"cp-opts" + (small ? " sm" : "")} role="radiogroup" aria-label={label}>
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

export function SetupScreen({
  gameName,
  setGameName,
  counts,
  setCounts,
  minutes,
  setMinutes,
  answerSeconds,
  setAnswerSeconds,
  rollSeconds,
  setRollSeconds,
  createGame,
  setupError,
  creating,
  goHome,
}: {
  gameName: SinTipo;
  setGameName: SinTipo;
  counts: SinTipo;
  setCounts: SinTipo;
  minutes: SinTipo;
  setMinutes: SinTipo;
  answerSeconds: SinTipo;
  setAnswerSeconds: SinTipo;
  rollSeconds: SinTipo;
  setRollSeconds: SinTipo;
  createGame: SinTipo;
  setupError: SinTipo;
  creating: SinTipo;
  goHome: SinTipo;
}) {
  // Un color con 0 alumnos simplemente NO JUEGA
  const activos = TURN_ORDER.filter((t) => counts[t] > 0);
  const totalStudents = TURN_ORDER.reduce((a, t) => a + counts[t], 0);
  const puedeCrear = activos.length >= 2 && gameName.trim().length > 0;

  const tiempos = [
    {
      titulo: "Duración de la partida",
      ayuda: "Cuánto dura toda la ronda de juego.",
      value: minutes,
      set: setMinutes,
      opts: [5, 10, 15, 20, 30, 45, 60, 90],
      fmt: (n) => `${n} min`,
    },
    {
      titulo: "Tiempo para responder",
      ayuda: "Segundos que tiene el equipo para contestar cada pregunta.",
      value: answerSeconds,
      set: setAnswerSeconds,
      opts: [10, 15, 20, 30, 45, 60, 90],
      fmt: (n) => `${n} s`,
    },
    {
      titulo: "Tiempo para lanzar el dado",
      ayuda: "Si nadie lanza a tiempo, el sistema lo hace solo.",
      value: rollSeconds,
      set: setRollSeconds,
      opts: [5, 10, 15, 20, 30],
      fmt: (n) => `${n} s`,
    },
  ];

  return (
    <div className="cp cp-home cfg2">
      <div className="cp-pagehead">
        <div>
          <span className="cp-eyebrow">Ludo por equipos</span>
          <h1>Crear una partida</h1>
          <p>Configúrala en tres pasos y obtendrás un código de 6 dígitos para proyectar a tu clase.</p>
        </div>
        <Button variant="ghost" onClick={goHome}>
          Cancelar
        </Button>
      </div>

      <div className="cfg2-grid">
        <div className="cfg2-form">
          {/* PASO 1 */}
          <section className="cp-card cp-panel" aria-labelledby="cfg2-p1">
            <div className="cfg2-step">
              <span>1</span>
              <h2 id="cfg2-p1">Nombre de la partida</h2>
            </div>
            <p>Así la verán tus estudiantes al entrar.</p>
            <label htmlFor="cfg2-nombre" className="cp-sr">
              Nombre de la partida
            </label>
            <input
              id="cfg2-nombre"
              className="cp-input"
              value={gameName}
              maxLength={60}
              placeholder="Ej. Derivadas: regla de la cadena"
              onChange={(e) => setGameName(e.target.value)}
            />
          </section>

          {/* PASO 2 */}
          <section className="cp-card cp-panel" aria-labelledby="cfg2-p2">
            <div className="cfg2-step">
              <span>2</span>
              <h2 id="cfg2-p2">Equipos que juegan</h2>
            </div>
            <p>
              Elige cuántos estudiantes hay en cada color (hasta 4). Los colores en «No juega» quedan fuera. Hacen falta
              al menos 2.
            </p>
            <div className="cfg2-teams">
              {TURN_ORDER.map((t) => {
                const n = counts[t];
                const on = n > 0;
                return (
                  <div key={t} data-t={t} className={"cfg2-team" + (on ? " on" : "")} style={{ "--tc": COLORS[t].hex }}>
                    <div className="cfg2-team-head">
                      <i aria-hidden="true" />
                      <strong>{COLORS[t].name}</strong>
                      <span>{on ? `${n} estudiante${n > 1 ? "s" : ""}` : "No juega"}</span>
                    </div>
                    <Chips
                      small
                      label={`Estudiantes del equipo ${COLORS[t].name}`}
                      value={n}
                      options={[0, 1, 2, 3, 4]}
                      format={(o) => (o === 0 ? "No juega" : o)}
                      onChange={(o) => setCounts({ ...counts, [t]: o })}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* PASO 3 */}
          <section className="cp-card cp-panel" aria-labelledby="cfg2-p3">
            <div className="cfg2-step">
              <span>3</span>
              <h2 id="cfg2-p3">Tiempos</h2>
            </div>
            <p>Durante la partida podrás pausar, sumar o restar tiempo.</p>
            <div className="cfg2-times">
              {tiempos.map((x) => (
                <div className="cfg2-time" key={x.titulo}>
                  <div>
                    <strong>{x.titulo}</strong>
                    <small>{x.ayuda}</small>
                  </div>
                  <Chips label={x.titulo} value={x.value} options={x.opts} format={x.fmt} onChange={x.set} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="cfg2-side" aria-label="Resumen de la partida">
          <div className="cp-card cp-panel cfg2-summary">
            <span className="cp-eyebrow">Resumen</span>
            <h2>{gameName.trim() || "Sin nombre todavía"}</h2>
            <div className="cfg2-sum-teams">
              {activos.length ? (
                activos.map((t) => (
                  <span key={t} className="cp-chip" style={{ "--tc": COLORS[t].hex }}>
                    <i className="cfg2-dot" aria-hidden="true" /> {COLORS[t].name} · {counts[t]}
                  </span>
                ))
              ) : (
                <span className="cp-muted">Ningún equipo seleccionado</span>
              )}
            </div>
            <dl className="cfg2-dl">
              <div>
                <dt>Equipos</dt>
                <dd>{activos.length}</dd>
              </div>
              <div>
                <dt>Estudiantes</dt>
                <dd>{totalStudents}</dd>
              </div>
              <div>
                <dt>Duración</dt>
                <dd>{minutes} min</dd>
              </div>
              <div>
                <dt>Para responder</dt>
                <dd>{answerSeconds} s</dd>
              </div>
              <div>
                <dt>Para lanzar el dado</dt>
                <dd>{rollSeconds} s</dd>
              </div>
            </dl>

            {activos.length < 2 && <p className="cp-help">Elige al menos 2 equipos para poder jugar.</p>}
            {gameName.trim().length === 0 && <p className="cp-help">Escribe un nombre para la partida.</p>}
            {setupError && (
              <p className="cp-msg error" role="alert">
                {setupError}
              </p>
            )}

            <Button size="lg" className="cp-full" disabled={!puedeCrear || creating} onClick={createGame}>
              {creating ? "Creando…" : "Crear partida"}
            </Button>
            <p className="cp-help">
              Se generará un código de 6 dígitos para que tus estudiantes entren desde el celular.
            </p>
          </div>

          <div className="cp-card cp-panel cfg2-how">
            <h3>Así funciona</h3>
            <Step n="1" t="Compartes el código" d="Los estudiantes entran desde su celular." />
            <Step n="2" t="El estudiante lanza el dado" d="Desde su celular, en su turno. Todos ven la animación." />
            <Step n="3" t="Acierta y avanza" d="La ficha avanza lo que marque el dado." />
            <Step n="4" t="Todo automático" d="El turno cambia solo; tú controlas el reloj." />
          </div>
        </aside>
      </div>
    </div>
  );
}

export const Step = ({ n, t, d }: { n: string; t: string; d: string }) => (
  <div className="cfg2-howstep">
    <b>{n}</b>
    <div>
      <strong>{t}</strong>
      <p>{d}</p>
    </div>
  </div>
);
