import { Brand } from "../Brand";
import { COLORS, TURN_ORDER } from "../constants";

export function FinishedScreen({ teams, gameName, winner, activeTeams = TURN_ORDER, isEngineer, myTeam, resetGame, newGame, changeDevice }) {
  const equipos = activeTeams.length ? activeTeams : TURN_ORDER;
  const ranking = [...equipos].sort((a, b) => teams[b].score - teams[a].score);
  // Si alguien llegó a la META gana por tablero; si no, gana el de más puntos.
  const champion = winner || ranking[0];
  // Si quien mira es un estudiante (tiene equipo propio), le mostramos SU
  // resultado personal (ganó/perdió) además del resultado general. El
  // docente no tiene equipo, así que sigue viendo solo el resultado objetivo.
  const miResultado = myTeam ? { gane: myTeam === champion, puesto: ranking.indexOf(myTeam) + 1 } : null;
  return (
    <div className="app reference-theme">
      <header className="ref-topbar">
        <Brand subtitle={<>Partida finalizada • {gameName}</>} />
        <div className="ref-controls">
          {isEngineer && (
            <>
              <button className="ref-green" onClick={resetGame}>
                🔄 Reiniciar partida
              </button>
              <button className="ref-yellow" onClick={newGame}>
                ➕ Crear partida nueva
              </button>
            </>
          )}
          <button className="ref-secondary small" onClick={changeDevice}>
            Volver al inicio
          </button>
        </div>
      </header>
      <main className="ref-content">
        <div className="ref-card wide finished-card">
          <span className="eyebrow">RESULTADOS FINALES</span>
          {miResultado && (
            <img
              className="finished-mascot"
              src={miResultado.gane ? "/mascota-gana.png" : "/mascota-pierde.png"}
              alt={miResultado.gane ? "Mascota de YachayPlay celebrando con un trofeo" : "Mascota de YachayPlay un poco triste"}
            />
          )}
          <h1>
            {miResultado
              ? miResultado.gane
                ? "🎉 ¡Tu equipo ganó!"
                : `Tu equipo quedó en el puesto #${miResultado.puesto}`
              : <>🏆 Equipo {COLORS[champion].name} gana la partida</>}
          </h1>
          <p className="muted">
            {miResultado && !miResultado.gane && <>El equipo {COLORS[champion].name} se llevó la victoria. </>}
            {winner
              ? "Llegó a la META con una de sus fichas."
              : "Ganó por puntaje acumulado (nadie llegó a la meta)."}
          </p>
          <div className="score-grid finished-grid">
            {ranking.map((t, i) => (
              <div
                className={"score-card" + (myTeam === t ? " mine" : "")}
                key={t}
                style={{ borderTopColor: COLORS[t].hex }}
              >
                <span>
                  #{i + 1} {COLORS[t].name}
                  {myTeam === t && " (tú)"}
                </span>
                <strong>{teams[t].score} / 20</strong>
                <small>
                  {teams[t].correct} correctas • {teams[t].incorrect} incorrectas
                </small>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ==================== Pantallas del docente ====================
