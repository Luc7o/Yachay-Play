import { Brand } from "../Brand";
import { COLORS, TURN_ORDER } from "../constants";

// ============================================================================
// LUDO · RESULTADOS — diseño "Campus", modo proyección (docente y estudiante).
// Props sin cambios.
// ============================================================================
export function FinishedScreen({
  teams,
  gameName,
  winner,
  activeTeams = TURN_ORDER,
  isEngineer,
  myTeam,
  resetGame,
  newGame,
  changeDevice,
}) {
  const equipos = activeTeams.length ? activeTeams : TURN_ORDER;
  const ranking = [...equipos].sort((a, b) => teams[b].score - teams[a].score);
  // Si alguien llegó a la META gana por tablero; si no, gana el de más puntos.
  const champion = winner || ranking[0];
  // Si quien mira es un estudiante (tiene equipo propio), le mostramos SU
  // resultado personal además del resultado general.
  const miResultado = myTeam ? { gane: myTeam === champion, puesto: ranking.indexOf(myTeam) + 1 } : null;
  const campeon = COLORS[champion];

  return (
    <div className="cp cp-proj">
      <header className="proj-top">
        <Brand />
        <div className="proj-top-info">
          <span className="cp-eyebrow">Ludo por equipos · partida terminada</span>
          <strong>{gameName}</strong>
        </div>
        <div className="eg-actions">
          {isEngineer && (
            <>
              <button type="button" className="cp-btn ghost" onClick={resetGame}>
                Jugar otra ronda
              </button>
              <button type="button" className="cp-btn ghost" onClick={newGame}>
                Partida nueva
              </button>
            </>
          )}
          <button type="button" className="cp-btn primary" onClick={changeDevice}>
            Volver al inicio
          </button>
        </div>
      </header>

      <main className="proj-main fin-main">
        <section className="cp-card fin-hero con-condor" style={{ "--tc": campeon.hex }}>
          <img
            className={"cp-condor fin-condor" + (miResultado && !miResultado.gane ? " casi" : "")}
            src="/condor-512.png"
            alt=""
            aria-hidden="true"
            width="512"
            height="512"
          />
          <span className="cp-eyebrow">Resultados finales</span>
          <h1>
            {miResultado ? (
              miResultado.gane ? (
                "¡Tu equipo ganó!"
              ) : (
                `Tu equipo quedó en el puesto ${miResultado.puesto}`
              )
            ) : (
              <>
                Gana el equipo{" "}
                <span className="fin-team">
                  <i aria-hidden="true" />
                  {campeon.name}
                </span>
              </>
            )}
          </h1>
          <p>
            {miResultado && !miResultado.gane && <>El equipo {campeon.name} se llevó la victoria. </>}
            {winner ? "Llegó a la meta con una de sus fichas." : "Ganó por puntaje acumulado (nadie llegó a la meta)."}
          </p>
        </section>

        <ol className="fin-ranking">
          {ranking.map((t, i) => (
            <li
              key={t}
              className={"cp-card fin-row" + (myTeam === t ? " mine" : "") + (t === champion ? " top" : "")}
              style={{ "--tc": COLORS[t].hex }}
            >
              <span className="fin-pos">{i + 1}</span>
              <span className="fin-name">
                <i aria-hidden="true" />
                {COLORS[t].name}
                {myTeam === t && <small> · tu equipo</small>}
              </span>
              <span className="fin-stats">
                {teams[t].correct} correctas · {teams[t].incorrect} incorrectas
              </span>
              <strong className="fin-score">
                {teams[t].score}
                <small> / 20</small>
              </strong>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
