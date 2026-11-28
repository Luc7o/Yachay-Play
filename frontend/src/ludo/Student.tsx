import { COLORS, TURN_ORDER } from "../constants";
import { Marca, BotonTema } from "../campusUi";
import { Dice } from "./Dice";
import { describeMove } from "./GameTab";
import { LudoBoard } from "./LudoBoard";
import { Button } from "../ui";
import type { ReactNode } from "react";
import type { SinTipo } from "../tipos";

// ============================================================================
// LUDO · PANTALLAS DEL ESTUDIANTE (celular) — diseño "Campus" (campusJuegos.css, "stu")
//   StudentJoin     escribir el código, el nombre y elegir equipo (sigue el tema de la app)
//   StudentWaiting  ya entró: espera a que el docente inicie (modo proyección, oscuro)
//   StudentGame     su turno: dado, pregunta y opciones (modo proyección, oscuro)
// Props sin cambios, salvo `isLogged` (opcional): oculta "Iniciar sesión / Crear cuenta".
// ============================================================================

function Barra({ onHome, derecha }: { onHome: SinTipo; derecha: ReactNode }) {
  return (
    <header className="stu-top">
      <Marca onClick={onHome} label="Volver al inicio de YachayPlay" />
      <div className="stu-top-right">{derecha}</div>
    </header>
  );
}

export function StudentJoin({
  joinCode,
  setJoinCode,
  studentName,
  setStudentName,
  studentTeam,
  setStudentTeam,
  submitJoin,
  joinError,
  gameInfo,
  goHome,
  onLogin,
  onRegister,
  isLogged = false,
}: {
  joinCode: SinTipo;
  setJoinCode: SinTipo;
  studentName: SinTipo;
  setStudentName: SinTipo;
  studentTeam: SinTipo;
  setStudentTeam: SinTipo;
  submitJoin: SinTipo;
  joinError: SinTipo;
  gameInfo: SinTipo;
  goHome: SinTipo;
  onLogin: () => void;
  onRegister: () => void;
  isLogged?: boolean;
}) {
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
    <div className="cp stu-page">
      <Barra
        onHome={goHome}
        derecha={
          <>
            <BotonTema />
            {!isLogged && onLogin && (
              <Button variant="quiet" onClick={onLogin}>
                Iniciar sesión
              </Button>
            )}
          </>
        }
      />

      <main className="stu-main">
        <form
          className="stu-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (puedeUnirse) submitJoin();
          }}
        >
          <div>
            <span className="cp-eyebrow">Ludo por equipos</span>
            <h1>Únete a la partida</h1>
            <p className="stu-lead">Escribe el código que aparece en la pantalla de tu docente.</p>
          </div>

          <div className="cp-field">
            <label htmlFor="join-code">Código</label>
            <input
              id="join-code"
              className={"cp-input stu-code" + (gameInfo ? " ok" : "")}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              aria-describedby="join-code-estado"
            />
            <p id="join-code-estado" className={"cp-help" + (gameInfo ? " stu-ok" : "")} role="status">
              {gameInfo ? (
                <>
                  Partida encontrada: <b>{gameInfo.name}</b>
                </>
              ) : codigoCompleto ? (
                "Buscando la partida… si no aparece, revisa el código."
              ) : (
                "Son 6 números."
              )}
            </p>
          </div>

          <div className="cp-field">
            <label htmlFor="join-name">Tu nombre</label>
            <input
              id="join-name"
              className="cp-input"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Ej. Andrea"
              maxLength={30}
              autoComplete="name"
            />
          </div>

          <fieldset className="stu-teams-field">
            <legend>Tu equipo</legend>
            {gameInfo ? (
              <>
                <div className="stu-teams">
                  {opciones.map((o) => {
                    const elegido = studentTeam === o.team;
                    return (
                      <label
                        key={o.team}
                        className={"stu-team" + (elegido ? " on" : "") + (o.lleno ? " lleno" : "")}
                        style={{ "--tc": COLORS[o.team].hex }}
                      >
                        <input
                          type="radio"
                          name="stu-team"
                          value={o.team}
                          checked={elegido}
                          disabled={o.lleno}
                          onChange={() => setStudentTeam(o.team)}
                        />
                        <span className="stu-team-head">
                          <i aria-hidden="true" />
                          <b>{COLORS[o.team].name}</b>
                        </span>
                        <span className="stu-pips" aria-hidden="true">
                          {Array.from({ length: o.cupo }, (_, i) => (
                            <i key={i} className={i < o.ocupados ? "full" : ""} />
                          ))}
                        </span>
                        <small>{o.lleno ? "Equipo lleno" : `${o.ocupados} de ${o.cupo} lugares`}</small>
                      </label>
                    );
                  })}
                </div>
                {!hayCupo && <p className="cp-msg error">Todos los equipos están llenos.</p>}
              </>
            ) : (
              <p className="cp-help">Cuando el código sea correcto, aquí aparecerán los equipos disponibles.</p>
            )}
          </fieldset>

          {joinError && (
            <p className="cp-msg error" role="alert">
              {joinError}
            </p>
          )}
          <Button size="lg" className="cp-full" type="submit" disabled={!puedeUnirse}>
            Entrar a la partida
          </Button>
          {!isLogged && onRegister && (
            <p className="cp-help stu-center">
              Con una cuenta, la partida queda en tu historial.{" "}
              <button type="button" className="cp-link" onClick={onRegister}>
                Crear cuenta
              </button>
            </p>
          )}
        </form>
      </main>
    </div>
  );
}

export function StudentWaiting({
  gameCode,
  studentName,
  studentTeam,
  changeDevice,
}: {
  gameCode: SinTipo;
  studentName: SinTipo;
  studentTeam: SinTipo;
  changeDevice: SinTipo;
}) {
  const color = COLORS[studentTeam] || COLORS.rojo;
  return (
    <div className="cp cp-proj stu-page">
      <Barra
        onHome={changeDevice}
        derecha={
          <Button variant="ghost" onClick={changeDevice}>
            Salir
          </Button>
        }
      />
      <main className="stu-main">
        <div className="stu-card stu-wait" style={{ "--tc": color.hex }}>
          <span className="cp-live">Partida {gameCode}</span>
          <h1>Ya estás dentro</h1>
          <div className="stu-me">
            <i aria-hidden="true" />
            <div>
              <strong>{studentName || "Estudiante"}</strong>
              <small>Equipo {color.name}</small>
            </div>
          </div>
          <div className="stu-wait-box">
            <span className="stu-pulse" aria-hidden="true" />
            <div>
              <strong>Espera a tu docente</strong>
              <p>Cuando inicie la partida, aquí aparecerán el dado y las preguntas en tu turno.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function StudentGame({
  serverState,
  playerId,
  selected,
  phaseSeconds,
  positions,
  submitAnswer,
  rollDice,
  changeDevice,
}: {
  serverState: SinTipo;
  playerId: SinTipo;
  selected: SinTipo;
  phaseSeconds: SinTipo;
  positions: SinTipo;
  submitAnswer: SinTipo;
  rollDice: SinTipo;
  changeDevice: SinTipo;
}) {
  const me = serverState.players.find((p) => p.id === playerId);
  const myTeam = me?.team;
  const isMyTurn = serverState.currentTeam === myTeam;
  const { turnPhase, currentQuestion: question, lastResult, lastDice, rolledBy } = serverState;

  const canAnswer = isMyTurn && turnPhase === "question" && selected === null;
  const revealed = turnPhase === "result" && !!lastResult;
  const rival = COLORS[serverState.currentTeam];
  const color = COLORS[myTeam] || COLORS.rojo;
  const limite = serverState.answerTimeLimit || 20;
  const quedan = phaseSeconds ?? 0;

  return (
    <div className="cp cp-proj stu-page stu-game">
      <header className="stu-game-top">
        <div>
          <span className="cp-eyebrow">Ludo · partida {serverState.code}</span>
          <strong>{isMyTurn ? "Turno de tu equipo" : `Turno del equipo ${rival.name}`}</strong>
        </div>
        <span className="stu-chip" style={{ "--tc": color.hex }}>
          <i aria-hidden="true" />
          Equipo {color.name}
        </span>
      </header>

      <main className="stu-main stu-main-game">
        {/* ---------- FASE 1: LANZAR EL DADO ---------- */}
        {turnPhase === "roll" && (
          <section className="stu-card stu-roll">
            <Dice value={null} rolling={false} />
            {isMyTurn ? (
              <>
                <h2>¡Es tu turno!</h2>
                <Button size="lg" className="cp-full" onClick={rollDice}>
                  Lanzar el dado
                </Button>
                <p className="cp-help">
                  Si nadie lanza en <b>{quedan} s</b>, el sistema lo lanza por ustedes.
                </p>
              </>
            ) : (
              <>
                <h2>Turno del equipo {rival.name}</h2>
                <p className="cp-help">Están lanzando el dado… ({quedan} s)</p>
              </>
            )}
          </section>
        )}

        {/* ---------- FASE 2: EL DADO GIRANDO ---------- */}
        {turnPhase === "rolling" && (
          <section className="stu-card stu-roll">
            <Dice value={lastDice} rolling />
            <h2>Lanzando…</h2>
            <p className="cp-help">{rolledBy ? `Lanzó ${rolledBy}` : "Lo lanzó el sistema"}</p>
          </section>
        )}

        {/* ---------- FASES 3 y 4: PREGUNTA Y RESULTADO ---------- */}
        {(turnPhase === "question" || turnPhase === "result") && question && (
          <>
            <div className="stu-dice-row">
              <Dice value={lastDice} rolling={false} size="mini" />
              <div>
                <strong>Salió {lastDice}</strong>
                <small>
                  {isMyTurn
                    ? `Si aciertan, avanzan ${lastDice} casilla${lastDice > 1 ? "s" : ""}`
                    : `Turno de ${rival.name}`}
                </small>
              </div>
            </div>

            {turnPhase === "question" && (
              <div className="stu-timer">
                <div>
                  <span>Tiempo para responder</span>
                  <b className={quedan <= 5 ? "urgente" : ""}>0:{String(quedan).padStart(2, "0")}</b>
                </div>
                <div
                  className="stu-timer-bar"
                  role="progressbar"
                  aria-label="Tiempo restante"
                  aria-valuemin={0}
                  aria-valuemax={limite}
                  aria-valuenow={quedan}
                >
                  <i
                    style={{ width: `${Math.min(100, (quedan / limite) * 100)}%` }}
                    className={quedan <= 5 ? "urgente" : ""}
                  />
                </div>
              </div>
            )}

            <section className="stu-card stu-question">
              <span className="cp-eyebrow">
                {question.topic}
                {question.level ? ` · ${question.level}` : ""}
              </span>
              <h2>{question.question}</h2>
            </section>

            <div className="stu-options" role="group" aria-label="Opciones de respuesta">
              {question.options.map((o, i: number) => {
                let estado = "";
                if (revealed) {
                  if (i === lastResult.correctIndex) estado = "correcta";
                  else if (i === lastResult.selectedIndex) estado = "incorrecta";
                } else if (selected === i) estado = "elegida";
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={!canAnswer}
                    className={"stu-opt " + estado}
                    aria-pressed={selected === i}
                    onClick={() => submitAnswer(i)}
                  >
                    <span className="stu-opt-letra">{String.fromCharCode(65 + i)}</span>
                    <span className="stu-opt-txt">{o}</span>
                  </button>
                );
              })}
            </div>

            {turnPhase === "question" && selected !== null && (
              <p className="cp-help stu-center" role="status">
                Respuesta enviada. Esperando el resultado…
              </p>
            )}

            {revealed && (
              <div className={"stu-result " + (lastResult.isCorrect ? "ok" : "bad")} role="status">
                <strong>
                  {isMyTurn
                    ? lastResult.isCorrect
                      ? describeMove(lastResult)
                      : lastResult.timedOut
                        ? `Se acabó el tiempo. La respuesta correcta era: ${lastResult.correctText}`
                        : `Incorrecto. La respuesta correcta era: ${lastResult.correctText}`
                    : `El equipo ${COLORS[lastResult.team].name} respondió ${lastResult.isCorrect ? "correctamente" : "de forma incorrecta"}.`}
                </strong>
                <small>Siguiente turno en {quedan} s…</small>
              </div>
            )}
          </>
        )}

        {/* El tablero va debajo: lo primero que ve el estudiante es lo que tiene que hacer */}
        <section className="stu-card stu-board" aria-label="Tablero">
          <LudoBoard players={serverState.players} positions={positions} activeTeams={serverState.activeTeams} small />
        </section>

        <Button variant="ghost" onClick={changeDevice}>
          Salir de la partida
        </Button>
      </main>
    </div>
  );
}
