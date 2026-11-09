import { Brand } from "../Brand";
import { mmss } from "./helpers";
import { Step } from "./Common";
import { CwTeacherLive, CwLeaderboard } from "./CwTeacherLive";

// ============================================================================
// DOCENTE: sala (espera → en curso → resultados), todo según live.status
// ============================================================================
export function CwTeacherRoom({ code, live, now, goHome, onStart, onEnd, onReset, onNewGame, error }) {
  if (!live) {
    return (
      <div className="app cfg-page">
        <header className="ref-topbar"><Brand subtitle="Crucigrama Relámpago" onClick={goHome} /></header>
        <main className="cfg-main"><p>Cargando…</p></main>
      </div>
    );
  }
  const board = live.leaderboard;

  return (
    <div className="app cfg-page">
      <header className="ref-topbar">
        <Brand subtitle={<>{live.name} • Código {code}</>} onClick={goHome} />
      </header>
      <main className="cfg-main" style={live.status === "lobby" ? undefined : { gridTemplateColumns: "1fr" }}>
        <div className="cfg-form">
          {live.status === "lobby" && (
            <>
              <button className="back-link" onClick={goHome}>← Volver al inicio</button>
              <div className="cw-lobby-head">
                <span className="cw-lobby-badge"><i /> SALA DE ESPERA</span>
                <h1 className="cfg-title">{live.name}</h1>
                <div className="cw-lobby-chips">
                  <span>🧩 {live.clues.length} palabras</span>
                  <span>⏱️ {live.minutes} min</span>
                  <span>🧊 🌫️ 💰 Sabotajes</span>
                </div>
              </div>

              <div className="cw-code-box">
                <span>CÓDIGO DE PARTIDA</span>
                <b>{code}</b>
                <small>Tus estudiantes lo escriben para unirse desde su celular.</small>
                <button
                  type="button"
                  className="cw-copy-btn"
                  onClick={(e) => {
                    navigator.clipboard?.writeText(code);
                    const btn = e.currentTarget;
                    btn.textContent = "✓ Copiado";
                    setTimeout(() => { btn.textContent = "📋 Copiar código"; }, 1500);
                  }}
                >
                  📋 Copiar código
                </button>
              </div>

              {["localhost", "127.0.0.1"].includes(window.location.hostname) ? (
                <p className="wait-code-warn">
                  ⚠️ Estás en "localhost": los celulares no podrán abrirlo. Abre esta página con la IP de tu
                  computadora (por ejemplo, http://192.168.1.10:5173).
                </p>
              ) : (
                <p className="cw-join-url">
                  📱 Que entren a <b>{window.location.host}</b> y elijan <b>“Entrar como invitado”</b> o <b>“Unirme con código”</b>.
                </p>
              )}

              <div className="cw-players-head">
                <h3 className="cw-side-title">Estudiantes conectados</h3>
                <span className="cw-players-count">{board.length}</span>
              </div>
              {board.length === 0 ? (
                <div className="cw-players-empty">
                  <span className="cw-pulse" />
                  <p>Esperando a que los estudiantes se unan…</p>
                  <small>Aparecerán aquí en cuanto ingresen el código.</small>
                </div>
              ) : (
                <ul className="cw-players-grid">
                  {board.map((p, i) => (
                    <li key={p.id} style={{ "--h": (i * 57 + 205) % 360 }}>
                      <span className="cw-player-avatar" aria-hidden="true">{p.name.trim().charAt(0).toUpperCase()}</span>
                      <span className="cw-player-name">{p.name}</span>
                      <span className="cw-player-ready">Listo</span>
                    </li>
                  ))}
                </ul>
              )}
              {error && <p className="join-error">{error}</p>}
              <button className="cfg-create" disabled={board.length === 0} onClick={onStart}>
                {board.length === 0 ? "Esperando estudiantes…" : `Iniciar partida con ${board.length} estudiante${board.length === 1 ? "" : "s"} ▶`}
              </button>
              <p className="cw-start-hint">Puedes iniciar cuando quieras: quien entre después se sumará con la partida en curso.</p>
            </>
          )}

          {live.status === "playing" && (
            <>
              <div className="cw-teacher-topline">
                <span className="hero-eyebrow">EN VIVO</span>
                <span className="cw-code-pill">Código {code}</span>
                <div className="cw-teacher-actions">
                  <button className="cw-btn-ghost" onClick={onReset}>🔄 Reiniciar</button>
                  <button className="cw-btn-danger" onClick={onEnd}>🏁 Finalizar partida</button>
                </div>
              </div>
              <h1 className={"cw-bigtimer" + (live.endsAt - now < 60000 ? " urgent" : "")} aria-label="Tiempo restante">⏱️ {mmss(live.endsAt - now)}</h1>
              {error && <p className="join-error">{error}</p>}
              <CwTeacherLive live={live} />
            </>
          )}

          {live.status === "ended" && (
            <>
              <div className="cw-teacher-topline">
                <span className="hero-eyebrow">
                  {live.endReason === "completed" ? "¡CRUCIGRAMA COMPLETADO!" : live.endReason === "teacher" ? "FINALIZADA POR EL DOCENTE" : "SE ACABÓ EL TIEMPO"}
                </span>
                <span className="cw-code-pill">Código {code}</span>
              </div>
              <div className="cw-teacher-win">
                <img className="result-mascot" src="/mascota-gana.png" alt="Mascota de YachayPlay celebrando con un trofeo" />
                <div>
                  <h1 className="cfg-title">🏁 Resultados</h1>
                  {(() => {
                    const ganador = board.find((p) => p.id === live.winnerId);
                    if (!ganador) return <p className="cfg-lead">🤝 Terminó sin ganador: nadie sumó puntos.</p>;
                    return (
                      <p className="cfg-lead">
                        🥇 Ganó <b>{ganador.name}</b> con {ganador.score} pts
                        {live.endReason === "completed" ? " por completar el crucigrama primero" : " por tener más puntos"}
                      </p>
                    );
                  })()}
                </div>
              </div>
              {error && <p className="join-error">{error}</p>}
              <CwTeacherLive live={live} ended />
              <CwLeaderboard board={board} showMedals />
              <div className="cw-teacher-actions cw-teacher-actions-end">
                <button className="cfg-create" onClick={onNewGame}>➕ Crear otra partida</button>
                <button className="cw-btn-ghost" onClick={onReset}>🔄 Repetir con el mismo código</button>
              </div>
            </>
          )}
        </div>

        {live.status === "lobby" && (
          <aside className="cfg-side cw-lobby-side">
            <div className="cw-mascot-card">
              <img src="/mascota-explica.png" alt="Mascota de YachayPlay señalando con el dedo" />
              <div className="cw-bubble">
                <b>¡Todo listo, profe!</b>
                <p>Proyecta el código en la pizarra. Apenas los estudiantes se unan, verás sus nombres aparecer.</p>
              </div>
            </div>

            <div className="cfg-how">
              <h3>Cómo se juega</h3>
              <Step n="1" t="Todos resuelven el mismo crucigrama" d="Cada estudiante tiene su propio tablero en el celular." />
              <Step n="2" t="Las rachas dan energía" d="Cada acierto seguido carga la barra de sabotajes." />
              <Step n="3" t="Sabotea a un rival" d="Congela 🧊, pon niebla 🌫️ o roba puntos 💰." />
              <Step n="4" t="Gana quien más puntos junte" d="Verás el marcador en vivo desde tu pantalla." />
            </div>

            <div className="cw-lobby-tip">
              💡 <span><b>Consejo:</b> espera a que estén todos conectados antes de iniciar para que compitan en igualdad.</span>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
