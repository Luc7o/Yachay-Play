import { Brand } from "../Brand";
import { COLORS, TURN_ORDER } from "../constants";
import { Dice } from "./Dice";
import { describeMove } from "./GameTab";
import { LudoBoard } from "./LudoBoard";

export function StudentJoin({ joinCode, setJoinCode, studentName, setStudentName, studentTeam, setStudentTeam, submitJoin, joinError, gameInfo, goHome }) {
  // Colores que juegan en ESA partida, con su cupo disponible
  const opciones = (gameInfo?.activeTeams || TURN_ORDER).map((t) => {
    const ocupados = gameInfo ? gameInfo.players.filter((p) => p.team === t).length : 0;
    const cupo = gameInfo ? gameInfo.teams[t].slots : 4;
    return { team: t, ocupados, cupo, lleno: gameInfo ? ocupados >= cupo : false };
  });
  const hayCupo = opciones.some((o) => !o.lleno);
  const codigoCompleto = joinCode.trim().length === 6;
  const puedeUnirse = studentName.trim() && codigoCompleto && gameInfo && hayCupo;

  return (
    <div className="app join-page">
      <header className="ref-topbar">
        <Brand subtitle="Ingreso del alumno" onClick={goHome} />
      </header>

      <main className="join-main">
        <aside className="join-guide">
          <img src="/mascota-explica.png" alt="" />
          <p>¡Hola! Escribe el código que tu docente proyectó y elige tu equipo.</p>
        </aside>

        <section className="join-card">
          <span className="hero-eyebrow">YACHAYPLAY · LUDO EDUCATIVO</span>
          <h1>Unirme a la partida</h1>

          {/* 1. Código */}
          <label className="join-label" htmlFor="join-code">
            <span className="cfg-num">1</span> Código de partida
          </label>
          <input
            id="join-code"
            className={"join-code" + (gameInfo ? " ok" : "")}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
          />
          {gameInfo ? (
            <p className="join-status ok">✓ Partida encontrada: <b>{gameInfo.name}</b></p>
          ) : codigoCompleto ? (
            <p className="join-status wait">Buscando la partida… si no aparece, revisa el código.</p>
          ) : (
            <p className="join-status">Son 6 números. Míralos en la pantalla del docente.</p>
          )}

          {/* 2. Nombre */}
          <label className="join-label" htmlFor="join-name">
            <span className="cfg-num">2</span> Tu nombre
          </label>
          <input
            id="join-name"
            className="join-name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Ej. Andrea"
            maxLength={30}
          />

          {/* 3. Equipo */}
          <label className="join-label">
            <span className="cfg-num">3</span> Tu equipo
          </label>
          {gameInfo ? (
            <>
              <div className="join-teams">
                {opciones.map((o) => {
                  const elegido = studentTeam === o.team;
                  return (
                    <button
                      key={o.team}
                      type="button"
                      disabled={o.lleno}
                      className={"join-team" + (elegido ? " picked" : "")}
                      style={{ "--tc": COLORS[o.team].hex, "--ts": COLORS[o.team].soft }}
                      onClick={() => setStudentTeam(o.team)}
                    >
                      <span className="join-team-top">
                        <i className="join-team-dot" />
                        <b>{COLORS[o.team].name}</b>
                        {elegido && <span className="join-check">✓</span>}
                      </span>
                      <span className="join-pips" aria-hidden="true">
                        {Array.from({ length: o.cupo }, (_, i) => (
                          <i key={i} className={i < o.ocupados ? "full" : ""} />
                        ))}
                      </span>
                      <small>{o.lleno ? "Equipo lleno" : `${o.ocupados} de ${o.cupo} lugares ocupados`}</small>
                    </button>
                  );
                })}
              </div>
              {!hayCupo && <p className="join-error">Todos los equipos están llenos.</p>}
            </>
          ) : (
            <p className="join-hint">Cuando el código sea correcto, aquí aparecerán los equipos disponibles.</p>
          )}

          {joinError && <p className="join-error">{joinError}</p>}
          <button className="join-btn" disabled={!puedeUnirse} onClick={submitJoin}>
            ¡Unirme a la partida! 🎲
          </button>
          <button className="back-link" onClick={goHome}>← Volver al inicio</button>
        </section>
      </main>
    </div>
  );
}

export function StudentWaiting({ gameCode, studentName, studentTeam, changeDevice }) {
  return (
    <div className="app student-lobby">
      <header className="ref-topbar">
        <Brand subtitle="Ingreso del alumno" />
      </header>
      <main className="student-page">
        <div className="phone-card">
          <span className="eyebrow">YACHAYPLAY</span>
          <div className="join-success">✓</div>
          <h1>¡Ya estás dentro!</h1>
          <p className="muted">
            Partida <b>{gameCode}</b>
          </p>
          <div className="joined-summary">
            <strong>{studentName || "Alumno"}</strong>
            <span style={{ color: COLORS[studentTeam].hex }}>Equipo {COLORS[studentTeam].name}</span>
          </div>
          <div className="waiting">
            <div className="phone-icon">🎲</div>
            <h2>Espera al docente</h2>
            <p>Cuando el docente inicie la partida, la pregunta aparecerá aquí en tu turno.</p>
          </div>
          <button className="ref-secondary" onClick={changeDevice}>
            Salir
          </button>
        </div>
      </main>
    </div>
  );
}

export function StudentGame({ serverState, playerId, selected, phaseSeconds, positions, submitAnswer, rollDice, changeDevice }) {
  const me = serverState.players.find((p) => p.id === playerId);
  const myTeam = me?.team;
  const isMyTurn = serverState.currentTeam === myTeam;
  const { turnPhase, currentQuestion: question, lastResult, lastDice, rolledBy } = serverState;

  const canAnswer = isMyTurn && turnPhase === "question" && selected === null;
  const revealed = turnPhase === "result" && !!lastResult;
  const rivalName = COLORS[serverState.currentTeam].name;

  return (
    <div className="app student-lobby">
      <header className="ref-topbar">
        <Brand subtitle="Participación del alumno" />
        <div className="time-box">
          <span>PARTIDA</span>
          <b>{serverState.code}</b>
        </div>
      </header>
      <main className="student-page">
        <div className="phone-card">
          <span className="eyebrow" style={{ color: COLORS[myTeam]?.hex }}>
            EQUIPO {COLORS[myTeam]?.name.toUpperCase()} · {me?.name}
          </span>

          <div className="mobile-board-wrap">
            <LudoBoard players={serverState.players} positions={positions} activeTeams={serverState.activeTeams} small />
          </div>

          {/* ---------- FASE 1: LANZAR EL DADO ---------- */}
          {turnPhase === "roll" && (
            <div className="roll-zone">
              <Dice value={null} rolling={false} />
              {isMyTurn ? (
                <>
                  <h2>¡Es tu turno!</h2>
                  <button className="roll-btn" onClick={rollDice}>
                    🎲 LANZAR DADO
                  </button>
                  <p className="muted">
                    Si nadie lanza en <b>{phaseSeconds ?? 0}s</b>, el sistema lo lanza por ustedes.
                  </p>
                </>
              ) : (
                <>
                  <h2>Turno del equipo {rivalName}</h2>
                  <p className="muted">Están lanzando el dado… ({phaseSeconds ?? 0}s)</p>
                </>
              )}
            </div>
          )}

          {/* ---------- FASE 2: EL DADO GIRANDO ---------- */}
          {turnPhase === "rolling" && (
            <div className="roll-zone">
              <Dice value={lastDice} rolling />
              <h2>Lanzando…</h2>
              <p className="muted">{rolledBy ? `Lanzó ${rolledBy}` : "Lo lanzó el sistema"}</p>
            </div>
          )}

          {/* ---------- FASES 3 y 4: PREGUNTA Y RESULTADO ---------- */}
          {(turnPhase === "question" || turnPhase === "result") && question && (
            <>
              <div className="dice-result-row">
                <Dice value={lastDice} rolling={false} size="mini" />
                <div>
                  <strong>Salió {lastDice}</strong>
                  <small className="muted">
                    {isMyTurn ? `Acierten y avanzan ${lastDice} casilla${lastDice > 1 ? "s" : ""}` : `Turno de ${rivalName}`}
                  </small>
                </div>
              </div>

              {turnPhase === "question" && (
                <div className={`answer-timer ${(phaseSeconds ?? 0) <= 5 ? "answer-timer-urgent" : ""}`}>
                  ⏱️ <b>{phaseSeconds ?? 0}s</b> para responder
                </div>
              )}

              <h2 className="mobile-question">{question.question}</h2>
              <div className="mobile-options">
                {question.options.map((o, i) => {
                  let cls = "";
                  if (revealed) {
                    if (i === lastResult.correctIndex) cls = "mobile-correct";
                    else if (i === lastResult.selectedIndex) cls = "mobile-wrong";
                  } else if (selected === i) {
                    cls = "mobile-selected";
                  }
                  return (
                    <button key={o} disabled={!canAnswer} className={cls} onClick={() => submitAnswer(i)}>
                      <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                      <span className="opt-text">{o}</span>
                    </button>
                  );
                })}
              </div>

              {turnPhase === "question" && selected !== null && (
                <div className="answer-result">Respuesta enviada, esperando el resultado…</div>
              )}

              {revealed && (
                <>
                  <div className={`answer-result ${lastResult.isCorrect ? "result-ok" : "result-bad"}`}>
                    {isMyTurn
                      ? lastResult.isCorrect
                        ? describeMove(lastResult)
                        : lastResult.timedOut
                        ? `Se acabó el tiempo. La respuesta correcta era: ${lastResult.correctText}`
                        : `Incorrecto. La respuesta correcta era: ${lastResult.correctText}`
                      : `El equipo ${COLORS[lastResult.team].name} respondió ${
                          lastResult.isCorrect ? "correctamente" : "de forma incorrecta"
                        }.`}
                  </div>
                  <p className="muted">Siguiente turno en {phaseSeconds ?? 0}s…</p>
                </>
              )}
            </>
          )}

          <button className="ref-secondary" onClick={changeDevice}>
            Salir
          </button>
        </div>
      </main>
    </div>
  );
}

