import { Brand } from "../Brand";
import { GameTab } from "./GameTab";
import { QuestionsTab, ScoresTab, RulesTab } from "./InfoTabs";

export function EngineerGame({ tab, setTab, serverState, timerSeconds, phaseSeconds, toggleTimer, addTime, resetTimer, skipTurn, endGame, resetGame, newGame, positions, bank, changeDevice }) {
  const currentTeam = serverState.currentTeam;
  const min = Math.floor((timerSeconds ?? 0) / 60).toString().padStart(2, "0");
  const sec = ((timerSeconds ?? 0) % 60).toString().padStart(2, "0");

  return (
    <div className="app reference-theme">
      <header className="ref-topbar">
        <Brand subtitle={<>{serverState.name} • Partida {serverState.code}</>} />
        <div className="ref-controls">
          {/* ---- CONTROL DEL TIEMPO DE LA PARTIDA (solo el docente) ---- */}
          <div className={`time-box ${timerSeconds !== null && timerSeconds <= 60 ? "time-low" : ""}`}>
            <span>TIEMPO</span>
            <b>{min}:{sec}</b>
          </div>
          <div className="time-controls">
            <button title="Quitar 1 minuto" onClick={() => addTime(-60)}>−1m</button>
            <button title="Agregar 1 minuto" onClick={() => addTime(60)}>+1m</button>
            <button title="Agregar 5 minutos" onClick={() => addTime(300)}>+5m</button>
            <button title="Reiniciar el reloj" onClick={resetTimer}>↺</button>
          </div>
          <button className="ref-yellow" onClick={toggleTimer}>
            {serverState.timerRunning ? "⏸ Pausar" : "▶ Iniciar"}
          </button>
          <button className="ref-green" onClick={resetGame}>
            🔄 Reiniciar
          </button>
          <button className="ref-yellow" onClick={newGame}>
            ➕ Partida nueva
          </button>
          <button className="ref-danger" onClick={endGame}>
            Finalizar
          </button>
        </div>
      </header>
      <nav className="ref-nav">
        {[
          ["game", "🎮", "Tablero e Interacción"],
          ["questions", "📚", `Banco de Preguntas (${bank.length || 20})`],
          ["scores", "📊", "Evaluación y Puntajes"],
          ["rules", "📋", "Guía y Reglas"],
        ].map(([id, ic, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {ic}
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {tab === "game" && (
        <GameTab
          gameName={serverState.name}
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
        />
      )}
      {tab === "questions" && <QuestionsTab bank={bank} />}
      {tab === "scores" && <ScoresTab teams={serverState.teams} history={serverState.history} />}
      {tab === "rules" && <RulesTab />}
    </div>
  );
}
