import "../live.css";
import { GOAL_STEP } from "../board";
import { COLORS } from "../constants";
import { Dice } from "./Dice";
import { LudoBoard } from "./LudoBoard";

// Texto que explica en qué momento del turno estamos (lo ven docente y alumnos)
export function phaseMessage({ turnPhase, currentTeam, phaseSeconds, dice, rolledBy, lastResult }) {
  const equipo = COLORS[currentTeam].name;
  switch (turnPhase) {
    case "roll":
      return `Esperando que el equipo ${equipo} lance el dado… (${phaseSeconds ?? 0}s)`;
    case "rolling":
      return "Lanzando el dado…";
    case "question":
      return `Respondiendo la pregunta… quedan ${phaseSeconds ?? 0}s`;
    case "result":
      return lastResult?.isCorrect
        ? describeMove(lastResult)
        : lastResult?.timedOut
          ? "Se acabó el tiempo, nadie respondió. La ficha no se mueve."
          : "Respuesta incorrecta. La ficha se queda donde está.";
    default:
      return "";
  }
}

export function GameTab({
  gameName,
  currentTeam,
  dice,
  turnPhase,
  phaseSeconds,
  rolledBy,
  question,
  lastResult,
  positions,
  players,
  teams,
  activeTeams,
  skipTurn,
  phaseTotal = 20,
}) {
  const showQuestion = turnPhase === "question" || turnPhase === "result";
  const turno = COLORS[currentTeam];
  return (
    <main className="proj-main eg-main">
      <section className="cp-card eg-board" aria-label="Tablero">
        <LudoBoard players={players} positions={positions} activeTeams={activeTeams} />
        <div className="eg-legend">
          {activeTeams.map((t) => (
            <span key={t}>
              <i style={{ background: COLORS[t].hex }} aria-hidden="true" />
              {COLORS[t].name}
            </span>
          ))}
        </div>
      </section>

      <aside className="eg-side">
        <div className="cp-card cp-panel eg-turn" style={{ "--tc": turno.hex }}>
          <div className="eg-turn-head">
            <span className="cp-eyebrow">Turno · automático</span>
            <span className="eg-team">
              <i aria-hidden="true" />
              {turno.name}
            </span>
          </div>
          <div className="eg-dice">
            <Dice value={dice} rolling={turnPhase === "rolling"} />
            <div className="eg-dice-info">
              <div className="proj-bar" aria-hidden="true">
                <i
                  className={"eg-phase-" + turnPhase}
                  style={{ width: `${Math.min(100, ((phaseSeconds ?? 0) / (phaseTotal || 20)) * 100)}%` }}
                />
              </div>
              <p>{phaseMessage({ turnPhase, currentTeam, phaseSeconds, dice, rolledBy, lastResult })}</p>
              {turnPhase !== "roll" && rolledBy && <small>Lanzó: {rolledBy}</small>}
              {turnPhase !== "roll" && !rolledBy && dice && <small>Lo lanzó el sistema (nadie llegó a tiempo)</small>}
            </div>
          </div>
          <p className="cp-help">
            La partida avanza sola: el estudiante lanza el dado desde su celular y el turno cambia automáticamente.
          </p>
          <button type="button" className="cp-btn ghost sm" onClick={skipTurn}>
            Saltar turno (solo si algo se traba)
          </button>
        </div>

        <div className="cp-card cp-panel eg-question">
          <span className="cp-eyebrow">Pregunta activa</span>
          {showQuestion && question ? (
            <>
              <h3>{question.question}</h3>
              <div className="eg-opts">
                {question.options.map((o, i) => {
                  let cls = "";
                  if (lastResult) {
                    if (i === lastResult.correctIndex) cls = " correcta";
                    else if (i === lastResult.selectedIndex) cls = " incorrecta";
                  }
                  return (
                    <div key={o} className={"eg-opt" + cls}>
                      <b>{String.fromCharCode(65 + i)}</b>
                      <span>{o}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="cp-help">La pregunta aparece apenas el equipo lance el dado.</p>
          )}
        </div>

        <div className="cp-card cp-panel">
          <div className="eg-turn-head">
            <span className="cp-eyebrow">Progreso</span>
            <span className="cp-muted" style={{ fontSize: 13 }}>
              {players.length} {players.length === 1 ? "estudiante" : "estudiantes"}
            </span>
          </div>
          <div className="eg-scores">
            {activeTeams.map((t) => (
              <div key={t} style={{ "--tc": COLORS[t].hex }}>
                <span>
                  <i aria-hidden="true" />
                  {COLORS[t].name}
                </span>
                <b>{teams[t].score} pts</b>
              </div>
            ))}
          </div>
          <ul className="cp-rows eg-pieces">
            {players.length === 0 && (
              <li>
                <span className="cp-muted">Nadie se ha conectado todavía.</span>
              </li>
            )}
            {players.map((p) => {
              const step = positions[p.id] ?? -1;
              return (
                <li key={p.id}>
                  <span className="board-piece" style={{ background: COLORS[p.team].hex }} aria-hidden="true">
                    {p.name.trim()[0]?.toUpperCase()}
                  </span>
                  <span className="cp-rows-main">
                    <strong>{p.name}</strong>
                  </span>
                  <span className="cp-rows-end">{describeStep(step)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </main>
  );
}

// Traduce un número de paso (0 a 56) a algo legible para el docente
export function describeStep(step) {
  if (step < 0) return "en casa";
  if (step >= GOAL_STEP) return "en la meta";
  if (step >= 51) return `recta final (${step - 50} de 6)`;
  return `casilla ${step + 1} de 57`;
}

// Arma la frase del movimiento que acaba de ocurrir
export function describeMove(lastResult) {
  const m = lastResult?.move;
  if (!m) return "¡Respuesta correcta!";
  if (!m.moved) return "¡Correcta! Pero el número se pasa de la meta: hace falta el número exacto.";
  let txt = `¡Correcta! ${lastResult.playerName} avanzó a la ${describeStep(m.to)}.`;
  if (m.captured.length) txt += ` Se comió la ficha de ${m.captured.join(", ")}.`;
  if (m.reachedGoal) txt += " ¡Llegó a la meta!";
  return txt;
}

// ==================== EL TABLERO DE LUDO REAL ====================
// Se dibuja como una cuadrícula CSS de 15 columnas x 15 filas.
// Cada casilla se coloca en su sitio con gridRow / gridColumn (1-indexado,
// por eso siempre sumamos +1 a las coordenadas de board.js, que van de 0 a 14).
