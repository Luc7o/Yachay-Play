import { Brand } from "../Brand";
import { phaseTotal } from "../constants";
import { GameTab } from "./GameTab";
import { QuestionsTab, ScoresTab, RulesTab } from "./InfoTabs";
import { Button } from "../ui";

// ============================================================================
// LUDO · PARTIDA EN CURSO (docente, para proyectar) — diseño "Campus", modo proyección.
// Props sin cambios.
// ============================================================================
const PESTANAS = [
  ["game", "Tablero"],
  ["questions", "Preguntas"],
  ["scores", "Puntajes"],
  ["rules", "Reglas"],
];

export function EngineerGame({
  tab,
  setTab,
  serverState,
  timerSeconds,
  phaseSeconds,
  toggleTimer,
  addTime,
  resetTimer,
  skipTurn,
  endGame,
  resetGame,
  newGame,
  positions,
  bank,
}) {
  const currentTeam = serverState.currentTeam;
  const min = Math.floor((timerSeconds ?? 0) / 60)
    .toString()
    .padStart(2, "0");
  const sec = ((timerSeconds ?? 0) % 60).toString().padStart(2, "0");
  const poco = timerSeconds !== null && timerSeconds <= 60;

  return (
    <div className="cp cp-proj">
      <header className="proj-top eg-top">
        <Brand />
        <div className="proj-top-info">
          <span className="cp-eyebrow">Ludo por equipos · partida {serverState.code}</span>
          <strong>{serverState.name}</strong>
        </div>

        {/* ---- CONTROL DEL TIEMPO DE LA PARTIDA (solo el docente) ---- */}
        <div className="eg-clock" role="group" aria-label="Tiempo de la partida">
          <div className={"eg-time" + (poco ? " poco" : "")}>
            <span>Tiempo</span>
            <b role="timer" aria-live="off">
              {min}:{sec}
            </b>
          </div>
          <div className="eg-time-btns">
            <Button variant="ghost" size="sm" title="Quitar 1 minuto" onClick={() => addTime(-60)}>
              −1 min
            </Button>
            <Button variant="ghost" size="sm" title="Agregar 1 minuto" onClick={() => addTime(60)}>
              +1 min
            </Button>
            <Button variant="ghost" size="sm" title="Agregar 5 minutos" onClick={() => addTime(300)}>
              +5 min
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Reiniciar el reloj"
              aria-label="Reiniciar el reloj"
              onClick={resetTimer}
            >
              ↺
            </Button>
          </div>
          <Button onClick={toggleTimer}>{serverState.timerRunning ? "Pausar" : "Iniciar reloj"}</Button>
        </div>

        <div className="eg-actions">
          <Button variant="ghost" size="sm" onClick={resetGame}>
            Reiniciar
          </Button>
          <Button variant="ghost" size="sm" onClick={newGame}>
            Partida nueva
          </Button>
          <Button variant="danger" size="sm" className="ghost" onClick={endGame}>
            Finalizar
          </Button>
        </div>
      </header>

      <nav className="eg-tabs" aria-label="Secciones de la partida">
        {PESTANAS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "on" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "questions" ? ` (${bank.length || 20})` : ""}
          </button>
        ))}
      </nav>

      {tab === "game" && (
        <GameTab
          currentTeam={currentTeam}
          dice={serverState.lastDice}
          turnPhase={serverState.turnPhase}
          phaseSeconds={phaseSeconds}
          rolledBy={serverState.rolledBy}
          question={serverState.currentQuestion}
          lastResult={serverState.lastResult}
          positions={positions}
          players={serverState.players}
          teams={serverState.teams}
          activeTeams={serverState.activeTeams}
          skipTurn={skipTurn}
          phaseTotal={phaseTotal(serverState)}
        />
      )}
      {tab === "questions" && <QuestionsTab bank={bank} />}
      {tab === "scores" && <ScoresTab teams={serverState.teams} history={serverState.history} />}
      {tab === "rules" && <RulesTab />}
    </div>
  );
}
