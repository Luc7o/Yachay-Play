import { Brand } from "../Brand";
import { mmss } from "./helpers";
import { Step } from "./Common";
import { CwTeacherLive, CwLeaderboard } from "./CwTeacherLive";

// ============================================================================
// CRUCIGRAMA · SALA DEL DOCENTE (espera → en curso → resultados, según live.status)
// Diseño "Campus", modo proyección (oscuro siempre). Props sin cambios.
// ============================================================================
function Barra({ live, code, goHome, children }) {
  return (
    <header className="proj-top">
      <Brand onClick={goHome} />
      <div className="proj-top-info">
        <span className="cp-eyebrow">Crucigrama relámpago · código {code}</span>
        <strong>{live?.name || "Cargando…"}</strong>
      </div>
      {children}
    </header>
  );
}

export function CwTeacherRoom({ code, live, now, goHome, onStart, onEnd, onReset, onNewGame, error }) {
  if (!live) {
    return (
      <div className="cp cp-proj">
        <Barra code={code} goHome={goHome} />
        <main className="proj-main">
          <p className="cp-muted" role="status">
            Cargando…
          </p>
        </main>
      </div>
    );
  }
  const board = live.leaderboard;
  const codigo = String(code);
  const esLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  // ---------------- SALA DE ESPERA ----------------
  if (live.status === "lobby") {
    return (
      <div className="cp cp-proj">
        <Barra live={live} code={code} goHome={goHome}>
          <button type="button" className="cp-btn ghost" onClick={goHome}>
            Salir al inicio
          </button>
        </Barra>
        <main className="proj-main">
          <section className="proj-stage" aria-labelledby="cwr-t">
            <div className="cp-card proj-hero">
              <div className="proj-hero-copy">
                <span className="cp-live">Sala abierta</span>
                <h1 id="cwr-t">
                  Entren en <b>{window.location.host}</b> con este código
                </h1>
                <p>
                  {live.clues.length} palabras · {live.minutes} min · con sabotajes entre rivales.
                </p>
                {esLocal ? (
                  <p className="proj-warn">
                    Estás en «localhost»: los celulares no podrán abrirlo. Abre esta página con la IP de tu computadora
                    (por ejemplo, http://192.168.1.10:5173).
                  </p>
                ) : (
                  <p>Que entren y elijan «Unirme con código» o «Entrar como invitado».</p>
                )}
                <div>
                  <button
                    type="button"
                    className="cp-btn ghost"
                    onClick={(e) => {
                      navigator.clipboard?.writeText(codigo);
                      const btn = e.currentTarget;
                      btn.textContent = "Código copiado";
                      setTimeout(() => {
                        btn.textContent = "Copiar código";
                      }, 1500);
                    }}
                  >
                    Copiar código
                  </button>
                </div>
              </div>
              <div className="proj-code" aria-label={`Código ${codigo.split("").join(" ")}`}>
                <span>Código</span>
                <strong>{codigo.length === 6 ? `${codigo.slice(0, 3)} ${codigo.slice(3)}` : codigo}</strong>
              </div>
            </div>

            <div className="cp-card cp-panel">
              <div className="proj-progress-top">
                <h2>En la sala</h2>
                <span>
                  {board.length} {board.length === 1 ? "estudiante" : "estudiantes"}
                </span>
              </div>
              {board.length === 0 ? (
                <div className="cwr-empty">
                  <span className="stu-pulse" aria-hidden="true" />
                  <p>Esperando a que los estudiantes se unan… aparecerán aquí en cuanto escriban el código.</p>
                </div>
              ) : (
                <div className="proj-members">
                  {board.map((p) => (
                    <span className="proj-member" key={p.id}>
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <p className="cp-msg error" role="alert">
                {error}
              </p>
            )}
            <div className="proj-actions">
              <button type="button" className="cp-btn primary lg" disabled={board.length === 0} onClick={onStart}>
                {board.length === 0
                  ? "Esperando estudiantes…"
                  : `Iniciar con ${board.length} estudiante${board.length === 1 ? "" : "s"}`}
              </button>
            </div>
            <p className="cp-help">
              Puedes iniciar cuando quieras: quien entre después se suma con la partida en curso.
            </p>
          </section>

          <aside className="proj-side" aria-label="Cómo se juega">
            <div className="cp-card cp-panel">
              <h2>Cómo se juega</h2>
              <Step
                n="1"
                t="Todos resuelven el mismo crucigrama"
                d="Cada estudiante tiene su propio tablero en el celular."
              />
              <Step n="2" t="Las rachas dan energía" d="Cada acierto seguido carga la barra de sabotajes." />
              <Step n="3" t="Sabotea a un rival" d="Congela, pon niebla o roba puntos." />
              <Step n="4" t="Gana quien más puntos junte" d="Verás el marcador en vivo desde tu pantalla." />
            </div>
            <div className="cp-card cp-panel">
              <h2>Consejo</h2>
              <p>Espera a que estén todos conectados antes de iniciar, para que compitan en igualdad.</p>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  // ---------------- EN CURSO ----------------
  if (live.status === "playing") {
    const restante = live.endsAt - now;
    return (
      <div className="cp cp-proj">
        <Barra live={live} code={code} goHome={goHome}>
          <div className={"eg-time" + (restante < 60000 ? " poco" : "")}>
            <span>Tiempo</span>
            <b role="timer" aria-live="off" aria-label="Tiempo restante">
              {mmss(restante)}
            </b>
          </div>
          <div className="eg-actions">
            <button type="button" className="cp-btn ghost sm" onClick={onReset}>
              Reiniciar
            </button>
            <button type="button" className="cp-btn ghost sm danger" onClick={onEnd}>
              Finalizar partida
            </button>
          </div>
        </Barra>
        <main className="proj-main cwr-main">
          {error && (
            <p className="cp-msg error" role="alert">
              {error}
            </p>
          )}
          <CwTeacherLive live={live} />
        </main>
      </div>
    );
  }

  // ---------------- RESULTADOS ----------------
  const ganador = board.find((p) => p.id === live.winnerId);
  const motivo =
    live.endReason === "completed"
      ? "Crucigrama completado"
      : live.endReason === "teacher"
        ? "Finalizada por el docente"
        : "Se acabó el tiempo";
  return (
    <div className="cp cp-proj">
      <Barra live={live} code={code} goHome={goHome}>
        <div className="eg-actions">
          <button type="button" className="cp-btn ghost" onClick={onReset}>
            Repetir con el mismo código
          </button>
          <button type="button" className="cp-btn primary" onClick={onNewGame}>
            Crear otra partida
          </button>
        </div>
      </Barra>
      <main className="proj-main cwr-main">
        <section className="cp-card fin-hero con-condor" style={{ "--tc": "#8FA0F0" }}>
          <img
            className="cp-condor fin-condor"
            src="/condor-512.png"
            alt=""
            aria-hidden="true"
            width="512"
            height="512"
          />
          <span className="cp-eyebrow">Resultados · {motivo}</span>
          <h1>{ganador ? <>Ganó {ganador.name}</> : "Terminó sin ganador"}</h1>
          <p>
            {ganador
              ? `${ganador.score} pts${live.endReason === "completed" ? ", por completar el crucigrama primero" : ", por tener más puntos"}.`
              : "Nadie sumó puntos."}
          </p>
        </section>
        {error && (
          <p className="cp-msg error" role="alert">
            {error}
          </p>
        )}
        <div className="cp-card cp-panel">
          <h2>Marcador final</h2>
          <CwLeaderboard board={board} showMedals />
        </div>
        <CwTeacherLive live={live} ended />
      </main>
    </div>
  );
}
