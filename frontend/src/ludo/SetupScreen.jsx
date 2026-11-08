import { Brand } from "../Brand";
import { COLORS, TURN_ORDER } from "../constants";

// Grupo de botones para elegir un valor (reemplaza a las listas desplegables)
export function Chips({ value, options, onChange, format, small }) {
  return (
    <div className={"cfg-chips" + (small ? " small" : "")} role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          role="radio"
          aria-checked={o === value}
          className={"cfg-chip" + (o === value ? " on" : "")}
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
}) {
  // Un color con 0 alumnos simplemente NO JUEGA
  const activos = TURN_ORDER.filter((t) => counts[t] > 0);
  const totalStudents = TURN_ORDER.reduce((a, t) => a + counts[t], 0);
  const puedeCrear = activos.length >= 2 && gameName.trim().length > 0;

  const tiempos = [
    { icon: "🕒", titulo: "Duración de la partida", ayuda: "Cuánto dura toda la clase de juego.", value: minutes, set: setMinutes, opts: [5, 10, 15, 20, 30, 45, 60, 90], fmt: (n) => `${n} min` },
    { icon: "⏱️", titulo: "Tiempo para responder", ayuda: "Segundos que tiene el equipo para contestar cada pregunta.", value: answerSeconds, set: setAnswerSeconds, opts: [10, 15, 20, 30, 45, 60, 90], fmt: (n) => `${n} s` },
    { icon: "🎲", titulo: "Tiempo para lanzar el dado", ayuda: "Si nadie lanza a tiempo, el sistema lo hace solo.", value: rollSeconds, set: setRollSeconds, opts: [5, 10, 15, 20, 30], fmt: (n) => `${n} s` },
  ];

  return (
    <div className="app cfg-page">
      <header className="ref-topbar">
        <Brand subtitle="Configuración de la partida" onClick={goHome} />
      </header>

      <main className="cfg-main">
        <div className="cfg-form">
          <button className="back-link" onClick={goHome}>← Volver al inicio</button>
          <span className="hero-eyebrow">PANEL DEL DOCENTE · LUDO EDUCATIVO</span>
          <h1 className="cfg-title">Crear una nueva partida</h1>
          <p className="cfg-lead">Completa estos 3 pasos y obtendrás un código para proyectarlo a tus estudiantes.</p>

          {/* PASO 1 */}
          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">1</span>
              <div>
                <h2>Nombre de la partida</h2>
                <p>Así la verán tus estudiantes al entrar.</p>
              </div>
            </div>
            <input
              className="cfg-input"
              value={gameName}
              maxLength={60}
              placeholder="Ej. Historia de la Ingeniería"
              onChange={(e) => setGameName(e.target.value)}
            />
          </section>

          {/* PASO 2 */}
          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">2</span>
              <div>
                <h2>Equipos que juegan</h2>
                <p>Elige cuántos alumnos hay en cada color (hasta 4). Los colores en “No juega” quedan fuera. Hacen falta al menos 2.</p>
              </div>
            </div>
            <div className="cfg-teams">
              {TURN_ORDER.map((t) => {
                const n = counts[t];
                const on = n > 0;
                return (
                  <div
                    key={t}
                    className={"cfg-team " + (on ? "on" : "off")}
                    style={{ "--tc": COLORS[t].hex, "--ts": COLORS[t].soft }}
                  >
                    <div className="cfg-team-head">
                      <i className="cfg-team-dot" />
                      <strong>{COLORS[t].name}</strong>
                      <span className="cfg-team-state">{on ? `${n} alumno${n > 1 ? "s" : ""}` : "No juega"}</span>
                    </div>
                    <Chips
                      small
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
          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">3</span>
              <div>
                <h2>Control del tiempo</h2>
                <p>Podrás pausar, sumar o restar tiempo durante la partida.</p>
              </div>
            </div>
            <div className="cfg-times">
              {tiempos.map((x) => (
                <div className="cfg-time" key={x.titulo}>
                  <div className="cfg-time-info">
                    <span className="cfg-time-icon">{x.icon}</span>
                    <div>
                      <strong>{x.titulo}</strong>
                      <p>{x.ayuda}</p>
                    </div>
                  </div>
                  <Chips value={x.value} options={x.opts} format={x.fmt} onChange={x.set} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="cfg-side">
          <div className="cfg-guide">
            <img src="/mascota-explica.png" alt="" />
            <p>¡Ya casi! Revisa el resumen y crea la partida.</p>
          </div>

          <div className="cfg-summary">
            <span className="preview-badge">RESUMEN</span>
            <h2>{gameName.trim() || "Sin nombre todavía"}</h2>

            <div className="cfg-sum-teams">
              {activos.length ? (
                activos.map((t) => (
                  <span key={t} className="cfg-sum-team" style={{ "--tc": COLORS[t].hex }}>
                    <i /> {COLORS[t].name} · {counts[t]}
                  </span>
                ))
              ) : (
                <span className="muted">Ningún equipo seleccionado</span>
              )}
            </div>

            <dl className="cfg-sum-list">
              <div><dt>Equipos jugando</dt><dd>{activos.length}</dd></div>
              <div><dt>Total de alumnos</dt><dd>{totalStudents}</dd></div>
              <div><dt>Duración</dt><dd>{minutes} min</dd></div>
              <div><dt>Para responder</dt><dd>{answerSeconds} s</dd></div>
              <div><dt>Para lanzar el dado</dt><dd>{rollSeconds} s</dd></div>
            </dl>

            {activos.length < 2 && <p className="join-error">Selecciona al menos 2 equipos para poder jugar.</p>}
            {gameName.trim().length === 0 && <p className="join-error">Escribe un nombre para la partida.</p>}
            {setupError && <p className="join-error">{setupError}</p>}

            <button className="cfg-create" disabled={!puedeCrear || creating} onClick={createGame}>
              {creating ? "Creando…" : "Crear partida 🚀"}
            </button>
            <p className="cfg-note">Se generará un código de 6 dígitos para que tus estudiantes se unan desde el celular.</p>
          </div>

          <div className="cfg-how">
            <h3>Así funcionará</h3>
            <Step n="1" t="Compartes el código" d="Los estudiantes ingresan desde sus propios celulares." />
            <Step n="2" t="El alumno lanza el dado" d="Desde su celular, en su turno. Todos ven la animación." />
            <Step n="3" t="Acierta y avanza" d="La ficha avanza el número del dado en el tablero." />
            <Step n="4" t="Todo automático" d="El turno cambia solo; tú solo controlas el reloj." />
          </div>
        </aside>
      </main>
    </div>
  );
}

export const Step = ({ n, t, d }) => (
  <div className="preview-step">
    <b>{n}</b>
    <div>
      <strong>{t}</strong>
      <p>{d}</p>
    </div>
  </div>
);
