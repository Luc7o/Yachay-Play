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
  return (
    <main className="ref-main">
      <section className="ref-board-panel">
        <div className="ref-title-row">
          <div>
            <span className="eyebrow">TABLERO DINÁMICO CLÁSICO</span>
            <h2>{gameName}</h2>
          </div>
          <span className="turn-chip" style={{ background: COLORS[currentTeam].soft, color: COLORS[currentTeam].hex }}>
            Turno: {COLORS[currentTeam].name}
          </span>
        </div>
        <LudoBoard players={players} positions={positions} activeTeams={activeTeams} />
        <div className="legend">
          {activeTeams.map((t) => (
            <span key={t}>
              <i className="dot" style={{ background: COLORS[t].hex }} />
              {COLORS[t].name}
            </span>
          ))}
        </div>
      </section>
      <aside className="ref-side">
        <div className="turn-banner" style={{ background: COLORS[currentTeam].soft, borderColor: COLORS[currentTeam].hex }}>
          <i className="dot" style={{ background: COLORS[currentTeam].hex }} />
          <span>Turno del equipo</span>
          <b style={{ color: COLORS[currentTeam].hex }}>{COLORS[currentTeam].name}</b>
        </div>
        <div className="ref-card">
          <div className="card-head">
            <span className="eyebrow">TURNO ACTUAL · AUTOMÁTICO</span>
            <span className="mini-team" style={{ color: COLORS[currentTeam].hex }}>
              {COLORS[currentTeam].name}
            </span>
          </div>
          <div className="dice-control">
            <Dice value={dice} rolling={turnPhase === "rolling"} />
            <div className="turn-info">
              <div className="phase-bar">
                <div
                  className={`phase-fill phase-${turnPhase}`}
                  style={{ width: `${Math.min(100, ((phaseSeconds ?? 0) / (phaseTotal || 20)) * 100)}%` }}
                />
              </div>
              <p className="status">
                {phaseMessage({ turnPhase, currentTeam, phaseSeconds, dice, rolledBy, lastResult })}
              </p>
              {turnPhase !== "roll" && rolledBy && <small className="muted">Lanzó: {rolledBy}</small>}
              {turnPhase !== "roll" && !rolledBy && dice && <small className="muted">Lo lanzó el sistema (nadie llegó a tiempo)</small>}
            </div>
          </div>
          <p className="projection-note">
            La partida avanza sola: el alumno lanza el dado desde su celular y el turno cambia automáticamente.
          </p>
          <button className="ref-secondary small full" onClick={skipTurn}>
            ⏭ Saltar turno (solo si algo se traba)
          </button>
        </div>
        <div className="ref-card question-card">
          <div className="question-top">
            <span className="eyebrow">PREGUNTA ACTIVA</span>
          </div>
          {showQuestion && question ? (
            <>
              <h3>{question.question}</h3>
              <div className="answer-options">
                {question.options.map((o, i) => {
                  let cls = "";
                  if (lastResult) {
                    if (i === lastResult.correctIndex) cls = "ok";
                    else if (i === lastResult.selectedIndex) cls = "bad";
                  }
                  return (
                    <button key={o} disabled className={cls}>
                      <b>{String.fromCharCode(65 + i)}</b>
                      {o}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-question">La pregunta aparecerá apenas el equipo lance el dado.</div>
          )}
        </div>
        <div className="ref-card">
          <div className="question-top">
            <span className="eyebrow">PROGRESO</span>
            <b>{players.length} alumnos</b>
          </div>
          <div className="team-mini-grid">
            {activeTeams.map((t) => (
              <div key={t}>
                <span style={{ color: COLORS[t].hex }}>{COLORS[t].name}</span>
                <b>{teams[t].score} pts</b>
                <small>{teams[t].slots} cupo{teams[t].slots > 1 ? "s" : ""}</small>
              </div>
            ))}
          </div>
          <div className="piece-list">
            {players.length === 0 && <small className="muted">Nadie se ha conectado todavía.</small>}
            {players.map((p) => {
              const step = positions[p.id] ?? -1;
              return (
                <div className="piece-row" key={p.id}>
                  <span className="board-piece" style={{ background: COLORS[p.team].hex }}>
                    {p.name.trim()[0]?.toUpperCase()}
                  </span>
                  <b>{p.name}</b>
                  <small>{describeStep(step)}</small>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </main>
  );
}

// Traduce un número de paso (0 a 56) a algo legible para el docente
export function describeStep(step) {
  if (step < 0) return "en casa";
  if (step >= GOAL_STEP) return "🏆 ¡en la META!";
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
  if (m.reachedGoal) txt += " 🏆 ¡LLEGÓ A LA META!";
  return txt;
}

// ==================== EL TABLERO DE LUDO REAL ====================
// Se dibuja como una cuadrícula CSS de 15 columnas x 15 filas.
// Cada casilla se coloca en su sitio con gridRow / gridColumn (1-indexado,
// por eso siempre sumamos +1 a las coordenadas de board.js, que van de 0 a 14).
