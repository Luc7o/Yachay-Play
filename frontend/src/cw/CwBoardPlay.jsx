import { useMemo, useRef, useState } from "react";
import { Brand } from "../Brand";
import { mmss } from "./helpers";
import { CwLeaderboard } from "./CwTeacherLive";

import "../cw.css";

export function CwBoardPlay({ live, now, myId, solvedMap, toasts, goHome, onSubmit, onSabotage }) {
  const [activeId, setActiveId] = useState(null);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState(null); // { ok, msg } del último intento
  const [cooldowns, setCooldowns] = useState({}); // placementId -> timestamp
  const [target, setTarget] = useState(null); // playerId elegido para sabotear
  const inputRef = useRef(null);

  const me = live.me;
  const congelado = me?.frozenUntil > now;
  const conNiebla = me?.fogUntil > now;

  const clues = live.clues;
  const across = clues.filter((c) => c.dir === "H").sort((a, b) => a.number - b.number);
  const down = clues.filter((c) => c.dir === "V").sort((a, b) => a.number - b.number);
  const activeClue = clues.find((c) => c.id === activeId) || null;

  // Rejilla de celdas, calculada una sola vez por lista de pistas / respuestas ya llenas
  const cellGrid = useMemo(() => {
    const g = Array.from({ length: live.grid.height }, () => Array(live.grid.width).fill(null));
    for (const c of clues) {
      for (let i = 0; i < c.length; i++) {
        const r = c.dir === "H" ? c.row : c.row + i;
        const col = c.dir === "H" ? c.col + i : c.col;
        if (!g[r][col]) g[r][col] = { number: null, letter: "" };
        if (i === 0 && c.number) g[r][col].number = c.number;
      }
    }
    for (const c of clues) {
      const palabra = solvedMap[c.id];
      if (!palabra) continue;
      for (let i = 0; i < c.length; i++) {
        const r = c.dir === "H" ? c.row : c.row + i;
        const col = c.dir === "H" ? c.col + i : c.col;
        g[r][col].letter = palabra[i];
      }
    }
    return g;
  }, [clues, solvedMap, live.grid.height, live.grid.width]);

  function elegirPista(c) {
    if (solvedMap[c.id]) return;
    setActiveId(c.id);
    setGuess("");
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function enviar() {
    if (!activeClue || congelado) return;
    const espera = cooldowns[activeClue.id];
    if (espera && espera > now) return;
    onSubmit(activeClue.id, guess, (ack) => {
      if (ack?.correct) {
        setFeedback({ ok: true, msg: `¡Bien! +${ack.points} pts${ack.finishBonus ? ` (+${ack.finishBonus} por terminar #${ack.finishRank})` : ""}` });
        setGuess("");
        // Avanza sola a la siguiente pista sin resolver
        const siguiente = clues.find((c) => c.id !== activeClue.id && !solvedMap[c.id]);
        setActiveId(siguiente ? siguiente.id : null);
      } else if (ack?.correct === false) {
        setFeedback({ ok: false, msg: "No es esa palabra, ¡sigue intentando!" });
        setCooldowns((p) => ({ ...p, [activeClue.id]: ack.cooldownUntil }));
      } else if (ack?.error) {
        setFeedback({ ok: false, msg: ack.error });
      }
    });
  }

  const rivales = live.leaderboard.filter((p) => p.id !== myId && !p.finished);
  const SABOTAJES = [
    { type: "freeze", icon: "🧊", label: "Congelar", cost: 35 },
    { type: "fog", icon: "🌫️", label: "Niebla", cost: 25 },
    { type: "steal", icon: "💰", label: "Robar", cost: 50 },
  ];

  function lanzarSabotaje(type, cost) {
    if (!target) return setFeedback({ ok: false, msg: "Elige a quién sabotear primero." });
    if ((me?.energy || 0) < cost) return setFeedback({ ok: false, msg: "No tienes suficiente energía todavía." });
    onSabotage(target, type, (ack) => {
      if (ack?.error) setFeedback({ ok: false, msg: ack.error });
    });
  }

  return (
    <div className="app cw-play-page">
      <header className="ref-topbar">
        <Brand subtitle={live.name} onClick={goHome} />
        <div className="cw-timer">⏱️ {mmss(live.endsAt - now)}</div>
      </header>

      <div className="cw-toasts">
        {toasts.map((t) => <div key={t.id} className="cw-toast">{t.texto}</div>)}
      </div>

      <main className="cw-play-main">
        <section className="cw-board-col">
          {congelado && <div className="cw-overlay">🧊 Congelado: {mmss(me.frozenUntil - now)}</div>}
          <div className="cw-grid-wrap">
            <div
              className="cw-grid"
              style={{ gridTemplateColumns: `repeat(${live.grid.width}, 1fr)`, aspectRatio: `${live.grid.width}/${live.grid.height}` }}
            >
              {cellGrid.flatMap((row, r) =>
                row.map((cell, c) => (
                  <div key={`${r}-${c}`} className={"cw-cell" + (cell ? "" : " blank")}>
                    {cell && (
                      <>
                        {cell.number && <span className="cw-cell-num">{cell.number}</span>}
                        <span className="cw-cell-letter">{cell.letter}</span>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {activeClue && (
            <div className="cw-answer-bar">
              <b>{activeClue.number}.</b> {conNiebla ? "🌫️ Niebla activa…" : activeClue.clue} <small>({activeClue.length})</small>
              <div className="cw-answer-row">
                <input
                  ref={inputRef}
                  className="cw-answer-input"
                  value={guess}
                  maxLength={activeClue.length}
                  disabled={congelado}
                  onChange={(e) => setGuess(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && enviar()}
                />
                <button className="join-btn" style={{ margin: 0, width: "auto", padding: "10px 20px" }} disabled={congelado || !guess} onClick={enviar}>
                  Enviar
                </button>
              </div>
              {feedback && <p className={feedback.ok ? "join-status ok" : "join-error"}>{feedback.msg}</p>}
            </div>
          )}
        </section>
        {activeClue && <div className="cw-answer-spacer" />}

        <aside className="cw-side-col">
          <div className="cw-mystats">
            <span><b>{me?.score || 0}</b> pts</span>
            <span>Puesto <b>{Math.max(1, live.leaderboard.findIndex((p) => p.id === myId) + 1)}</b> de {live.leaderboard.length}</span>
            {me?.streak > 0 && <span>Racha <b>{me.streak}</b></span>}
          </div>

          <div className="cw-energy">
            <span>⚡ Energía <b>{me?.energy || 0}</b></span>
            <div className="cw-energy-bar"><i style={{ width: `${me?.energy || 0}%` }} /></div>
          </div>

          <div className="cw-sabotage">
            <p className="cw-side-title">Elige a tu rival</p>
            <div className="cw-rivals">
              {rivales.map((p) => (
                <button key={p.id} className={"cw-rival" + (target === p.id ? " on" : "")} onClick={() => setTarget(p.id)}>
                  {p.name} <small>{p.score} pts</small>
                </button>
              ))}
              {rivales.length === 0 && <p className="muted">Sin rivales disponibles.</p>}
            </div>
            <div className="cw-sabo-btns">
              {SABOTAJES.map((s) => (
                <button key={s.type} className="cw-sabo-btn" disabled={(me?.energy || 0) < s.cost} onClick={() => lanzarSabotaje(s.type, s.cost)}>
                  <span>{s.icon}</span> {s.label}<small>{s.cost}⚡</small>
                </button>
              ))}
            </div>
          </div>

          <div className="cw-side-title">Pistas horizontales</div>
          <ul className="cw-clue-list">
            {across.map((c) => (
              <li key={c.id} className={solvedMap[c.id] ? "done" : activeId === c.id ? "active" : ""} onClick={() => elegirPista(c)}>
                <b>{c.number}.</b> {conNiebla && !solvedMap[c.id] ? "🌫️ ???" : c.clue} <small>({c.length})</small>
              </li>
            ))}
          </ul>
          <div className="cw-side-title">Pistas verticales</div>
          <ul className="cw-clue-list">
            {down.map((c) => (
              <li key={c.id} className={solvedMap[c.id] ? "done" : activeId === c.id ? "active" : ""} onClick={() => elegirPista(c)}>
                <b>{c.number}.</b> {conNiebla && !solvedMap[c.id] ? "🌫️ ???" : c.clue} <small>({c.length})</small>
              </li>
            ))}
          </ul>

          <div className="cw-side-title">Marcador</div>
          <CwLeaderboard board={live.leaderboard} />
        </aside>
      </main>
    </div>
  );
}
