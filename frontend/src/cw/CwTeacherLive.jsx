import { useMemo } from "react";
import { heatColor } from "./helpers";

import "../cw.css";

export function CwTeacherLive({ live, ended }) {
  const board = live.leaderboard;
  const clues = live.clues;
  const total = board.length;

  const avgProgress = total ? Math.round(board.reduce((s, p) => s + p.progress, 0) / total) : 0;
  const finishedCount = board.filter((p) => p.finished).length;
  const intentadas = clues.filter((c) => c.solvedCount > 0);
  const masDificil = total > 0 && intentadas.length
    ? [...intentadas].sort((a, b) => a.solvedCount - b.solvedCount)[0]
    : null;

  const across = clues.filter((c) => c.dir === "H").sort((a, b) => a.number - b.number);
  const down = clues.filter((c) => c.dir === "V").sort((a, b) => a.number - b.number);

  const cellGrid = useMemo(() => {
    const g = Array.from({ length: live.grid.height }, () => Array(live.grid.width).fill(null));
    for (const c of clues) {
      const pct = total ? c.solvedCount / total : 0;
      for (let i = 0; i < c.length; i++) {
        const r = c.dir === "H" ? c.row : c.row + i;
        const col = c.dir === "H" ? c.col + i : c.col;
        if (!g[r][col]) g[r][col] = { number: null, pct: 0, letter: "" };
        if (i === 0 && c.number) g[r][col].number = c.number;
        g[r][col].pct = Math.max(g[r][col].pct, pct);
        // Solo existe cuando el 100% ya la acertó (ver engine.js): recién ahí
        // se puede pintar la letra real en el tablero del docente.
        if (c.revealedWord) g[r][col].letter = c.revealedWord[i];
      }
    }
    return g;
  }, [clues, live.grid.height, live.grid.width, total]);

  return (
    <div className="cw-teacher-live">
      <div className="cw-stats-row">
        <div className="cw-stat-card">
          <span>Estudiantes</span>
          <b>{total}</b>
        </div>
        <div className="cw-stat-card">
          <span>Avance promedio</span>
          <b>{avgProgress}%</b>
        </div>
        <div className="cw-stat-card">
          <span>Ya terminaron</span>
          <b>{finishedCount}</b>
        </div>
        <div className="cw-stat-card cw-stat-wide">
          <span>Palabra más difícil</span>
          <b>{masDificil ? `${masDificil.number}. ${masDificil.clue}` : "Aún sin datos"}</b>
        </div>
      </div>

      <div className="cw-teacher-grid-row">
        <div className="cw-board-panel">
          <h3>🧩 Tablero compartido</h3>
          <p className="cw-board-sub">Mismo crucigrama para todos; cada quien lo llena a su ritmo.</p>
          <div className="cw-grid-wrap">
            <div
              className="cw-grid"
              style={{ gridTemplateColumns: `repeat(${live.grid.width}, 1fr)`, aspectRatio: `${live.grid.width}/${live.grid.height}` }}
            >
              {cellGrid.flatMap((row, r) =>
                row.map((cell, c) => (
                  <div
                    key={`${r}-${c}`}
                    className={"cw-cell" + (cell ? "" : " blank")}
                    style={cell ? { background: heatColor(cell.pct) } : undefined}
                  >
                    {cell?.number && <span className="cw-cell-num">{cell.number}</span>}
                    {cell?.letter && <span className="cw-cell-letter">{cell.letter}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
          <p className="cw-heat-legend"><span className="cw-legend-dot cw-legend-gray" /> En progreso &nbsp; <span className="cw-legend-dot cw-legend-green" /> Todos la resolvieron</p>
        </div>

        <div className="cw-side-col cw-teacher-clues">
          {!ended && (
            <div className="cw-panel-card cw-board-live">
              <div className="cw-side-title">Marcador en vivo</div>
              <CwLeaderboard board={board} />
            </div>
          )}
          <div className="cw-panel-card">
            <div className="cw-panel-scroll">
              <div className="cw-side-title">Pistas horizontales</div>
              <ul className="cw-clue-list cw-clue-list-readonly">
                {across.map((c) => <CwClueProgress key={c.id} c={c} total={total} />)}
              </ul>
              <div className="cw-side-title">Pistas verticales</div>
              <ul className="cw-clue-list cw-clue-list-readonly">
                {down.map((c) => <CwClueProgress key={c.id} c={c} total={total} />)}
              </ul>
            </div>
          </div>

          <div className="cw-panel-card">
            <div className="cw-side-title">📜 Actividad reciente</div>
            <div className="cw-panel-scroll cw-activity-scroll">
              <CwActivityLog log={live.log} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// Fila de eventos: sabotajes, quién se unió, quién terminó... para que el
// docente vea qué está pasando sin tener que adivinar por qué cambió el marcador.
export function CwActivityLog({ log }) {
  if (!log || log.length === 0) return <p className="muted">Aún no hay actividad.</p>;
  return (
    <ul className="cw-activity-list">
      {log.map((e) => (
        <li key={e.id} className={`cw-activity-${e.type || "info"}`}>
          <span className="cw-activity-time">
            {new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span>{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function CwClueProgress({ c, total }) {
  const pct = total ? Math.round((c.solvedCount / total) * 100) : 0;
  const completa = total > 0 && c.solvedCount === total;
  return (
    <li className={completa ? "done" : ""}>
      <div className="cw-clue-progress-row">
        <span><b>{c.number}.</b> {c.clue} <small>({c.length})</small></span>
        <small className="cw-clue-count">{c.solvedCount}/{total}</small>
      </div>
      <span className="cw-lb-bar"><i style={{ width: `${pct}%` }} /></span>
    </li>
  );
}

export function CwLeaderboard({ board, showMedals }) {
  const medal = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);
  return (
    <div className="cw-leaderboard">
      {board.map((p, i) => (
        <div className="cw-lb-row" key={p.id}>
          <span className="cw-lb-rank">{showMedals ? medal(i) : `${i + 1}.`}</span>
          <span className="cw-lb-name">{p.name}</span>
          <span className="cw-lb-bar"><i style={{ width: `${p.progress}%` }} /></span>
          <span className="cw-lb-score">{p.score} pts</span>
          {p.finished && <span className="cw-lb-done">✓</span>}
        </div>
      ))}
      {board.length === 0 && <p className="muted">Todavía no hay jugadores.</p>}
    </div>
  );
}
