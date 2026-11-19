import { Marca } from "../campusUi";
import { CwLeaderboard } from "./CwTeacherLive";
import { CwBoardPlay } from "./CwBoardPlay";

// ============================================================================
// CRUCIGRAMA · SALA DEL ESTUDIANTE (espera → jugando → resultados)
// Diseño "Campus", modo proyección (como Ludo en el celular). Props sin cambios.
// ============================================================================
function Marco({ live, goHome, children }) {
  return (
    <div className="cp cp-proj stu-page">
      <header className="stu-top">
        <Marca onClick={goHome} label="Volver al inicio de YachayPlay" />
        <button type="button" className="cp-btn ghost" onClick={goHome}>Salir</button>
      </header>
      <main className="stu-main">
        <span className="cp-eyebrow">Crucigrama relámpago · {live.name}</span>
        {children}
      </main>
    </div>
  );
}

export function CwStudentRoom({ live, now, myId, code, solvedMap, toasts, goHome, onSubmit, onSabotage }) {
  if (!live) return null;

  if (live.status === "lobby") {
    return (
      <Marco live={live} goHome={goHome}>
        <div className="stu-card">
          <span className="cp-live">Partida {code}</span>
          <h1>Ya estás dentro</h1>
          <div className="stu-wait-box">
            <span className="stu-pulse" aria-hidden="true" />
            <div>
              <strong>Espera a tu docente</strong>
              <p>Iniciará la partida en cualquier momento. Todos resuelven el mismo crucigrama, cada uno en su celular.</p>
            </div>
          </div>
        </div>
        <div className="stu-card">
          <h2>En la sala</h2>
          <CwLeaderboard board={live.leaderboard} />
        </div>
      </Marco>
    );
  }

  if (live.status === "ended") {
    const yo = live.leaderboard.find((p) => p.id === myId);
    const puesto = live.leaderboard.findIndex((p) => p.id === myId) + 1;
    const completada = live.endReason === "completed";
    const yoGane = live.winnerId === myId; // gana quien completó primero, o quien tiene más puntos
    const ganador = live.leaderboard.find((p) => p.id === live.winnerId);
    const motivo = completada ? "Crucigrama completado" : live.endReason === "teacher" ? "Tu docente finalizó la partida" : "Se acabó el tiempo";
    return (
      <Marco live={live} goHome={goHome}>
        <div className="stu-card fin-hero con-condor" style={{ "--tc": yoGane ? "#8FA0F0" : "#323A5A" }}>
          <img className={"cp-condor fin-condor" + (yoGane ? "" : " casi")} src="/condor-512.png" alt="" aria-hidden="true" width="512" height="512" />
          <span className="cp-eyebrow">{motivo}</span>
          <h1>{yoGane ? "¡Ganaste!" : ganador ? `Quedaste en el puesto ${puesto}` : "Nadie sumó puntos"}</h1>
          {yoGane && <p>{completada ? "Completaste todo el crucigrama primero." : "Terminaste con más puntos que todos."}</p>}
          {!yoGane && ganador && (
            <p>
              {completada
                ? <><b>{ganador.name}</b> completó el crucigrama primero y cerró la partida.</>
                : <><b>{ganador.name}</b> ganó con más puntos ({ganador.score} pts).</>}
            </p>
          )}
          <p>Tu puntaje: <b>{yo?.score ?? 0} pts</b></p>
        </div>
        <div className="stu-card">
          <h2>Marcador final</h2>
          <CwLeaderboard board={live.leaderboard} showMedals />
        </div>
        <button type="button" className="cp-btn primary lg" onClick={goHome}>Volver al inicio</button>
      </Marco>
    );
  }

  // status === "playing"
  return <CwBoardPlay live={live} now={now} myId={myId} solvedMap={solvedMap} toasts={toasts} goHome={goHome} onSubmit={onSubmit} onSabotage={onSabotage} />;
}
