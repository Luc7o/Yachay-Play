import { Brand } from "../Brand";
import { CwLeaderboard } from "./CwTeacherLive";
import { CwBoardPlay } from "./CwBoardPlay";

// ============================================================================
// ESTUDIANTE: sala (espera → jugando → resultados)
// ============================================================================
export function CwStudentRoom({ live, now, myId, code, solvedMap, toasts, goHome, onSubmit, onSabotage }) {
  if (!live) return null;

  if (live.status === "lobby") {
    return (
      <div className="app join-page">
        <header className="ref-topbar"><Brand subtitle={live.name} onClick={goHome} /></header>
        <main className="join-main" style={{ gridTemplateColumns: "1fr" }}>
          <section className="join-card" style={{ textAlign: "center" }}>
            <span className="hero-eyebrow">ESPERANDO AL DOCENTE</span>
            <h1>¡Ya estás dentro! 🎉</h1>
            <p className="cfg-lead">Código: <b>{code}</b> — el docente iniciará la partida en cualquier momento.</p>
            <CwLeaderboard board={live.leaderboard} />
            <button className="back-link" onClick={goHome}>← Volver al inicio</button>
          </section>
        </main>
      </div>
    );
  }

  if (live.status === "ended") {
    const yo = live.leaderboard.find((p) => p.id === myId);
    const puesto = live.leaderboard.findIndex((p) => p.id === myId) + 1;
    const completada = live.endReason === "completed";
    const yoGane = live.winnerId === myId; // gana quien completó primero, o quien tiene más puntos
    const ganador = live.leaderboard.find((p) => p.id === live.winnerId);
    return (
      <div className="app join-page">
        <header className="ref-topbar"><Brand subtitle={live.name} onClick={goHome} /></header>
        <main className="join-main" style={{ gridTemplateColumns: "1fr" }}>
          <section className="join-card" style={{ textAlign: "center" }}>
            <span className="hero-eyebrow">
              {completada ? "¡CRUCIGRAMA COMPLETADO!" : live.endReason === "teacher" ? "EL DOCENTE FINALIZÓ LA PARTIDA" : "¡SE ACABÓ EL TIEMPO!"}
            </span>
            <img
              className="result-mascot"
              src={yoGane ? "/mascota-gana.png" : "/mascota-pierde.png"}
              alt={yoGane ? "Mascota de YachayPlay celebrando con un trofeo" : "Mascota de YachayPlay animando a seguir intentando"}
            />
            <h1>{yoGane ? "🥇 ¡Ganaste!" : ganador ? `Quedaste en el puesto ${puesto}` : "Nadie sumó puntos"}</h1>
            {yoGane && (
              <p className="cfg-lead">{completada ? "¡Completaste todo el crucigrama primero!" : "¡Terminaste con más puntos que todos!"}</p>
            )}
            {!yoGane && ganador && (
              <p className="cfg-lead">
                {completada
                  ? <><b>{ganador.name}</b> completó el crucigrama primero y cerró la partida.</>
                  : <><b>{ganador.name}</b> ganó con más puntos ({ganador.score} pts).</>}
              </p>
            )}
            {!yoGane && ganador && <p className="cfg-lead">¡Buen intento! Con la práctica llegarás al primer lugar.</p>}
            <p className="cfg-lead">Tu puntaje: <b>{yo?.score ?? 0} pts</b></p>
            <CwLeaderboard board={live.leaderboard} showMedals />
            <button className="back-link" onClick={goHome}>← Volver al inicio</button>
          </section>
        </main>
      </div>
    );
  }

  // status === "playing"
  return <CwBoardPlay live={live} now={now} myId={myId} solvedMap={solvedMap} toasts={toasts} goHome={goHome} onSubmit={onSubmit} onSabotage={onSabotage} />;
}
