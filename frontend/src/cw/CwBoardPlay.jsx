import { useMemo, useRef, useState } from "react";
import { Marca } from "../campusUi";
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
    { type: "freeze", icon: <IconoCongelar />, label: "Congelar", cost: 35 },
    { type: "fog", icon: <IconoNiebla />, label: "Niebla", cost: 25 },
    { type: "steal", icon: <IconoRobar />, label: "Robar", cost: 50 },
  ];

  function lanzarSabotaje(type, cost) {
    if (!target) return setFeedback({ ok: false, msg: "Elige a quién sabotear primero." });
    if ((me?.energy || 0) < cost) return setFeedback({ ok: false, msg: "No tienes suficiente energía todavía." });
    onSabotage(target, type, (ack) => {
      if (ack?.error) setFeedback({ ok: false, msg: ack.error });
    });
  }

  return (
    <div className="cp cp-proj cw-play-page cwp">
      <header className="stu-top">
        <Marca onClick={goHome} label="Volver al inicio de YachayPlay" />
        <div className={"eg-time" + (live.endsAt - now < 60000 ? " poco" : "")}>
          <span>Tiempo</span>
          <b role="timer" aria-live="off">{mmss(live.endsAt - now)}</b>
        </div>
      </header>

      <div className="cw-toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className="cw-toast">{t.texto}</div>)}
      </div>

      <main className="cw-play-main">
        <section className="cw-board-col">
          {congelado && <div className="cw-overlay" role="alert">Congelado: {mmss(me.frozenUntil - now)}</div>}
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
              <b>{activeClue.number}.</b> {conNiebla ? "Niebla activa…" : activeClue.clue} <small>({activeClue.length})</small>
              <div className="cw-answer-row">
                <input
                  ref={inputRef}
                  aria-label={`Respuesta para la pista ${activeClue.number}`}
                  className="cp-input cw-answer-input"
                  value={guess}
                  maxLength={activeClue.length}
                  disabled={congelado}
                  onChange={(e) => setGuess(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && enviar()}
                />
                <button type="button" className="cp-btn primary" disabled={congelado || !guess} onClick={enviar}>
                  Enviar
                </button>
              </div>
              {feedback && <p className={feedback.ok ? "cp-msg ok" : "cp-msg error"} role="status">{feedback.msg}</p>}
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
            <span>Energía <b>{me?.energy || 0}</b></span>
            <div className="cw-energy-bar"><i style={{ width: `${me?.energy || 0}%` }} /></div>
          </div>

          <div className="cw-sabotage">
            <p className="cw-side-title">Elige a tu rival</p>
            <div className="cw-rivals">
              {rivales.map((p) => (
                <button type="button" key={p.id} aria-pressed={target === p.id} className={"cw-rival" + (target === p.id ? " on" : "")} onClick={() => setTarget(p.id)}>
                  {p.name} <small>{p.score} pts</small>
                </button>
              ))}
              {rivales.length === 0 && <p className="muted">Sin rivales disponibles.</p>}
            </div>
            <div className="cw-sabo-btns">
              {SABOTAJES.map((s) => (
                <button type="button" key={s.type} className="cw-sabo-btn" disabled={(me?.energy || 0) < s.cost} onClick={() => lanzarSabotaje(s.type, s.cost)}>
                  <span aria-hidden="true">{s.icon}</span> {s.label}<small>{s.cost} de energía</small>
                </button>
              ))}
            </div>
          </div>

          <div className="cw-side-title">Pistas horizontales</div>
          <ul className="cw-clue-list">
            {across.map((c) => (
              <li key={c.id} className={solvedMap[c.id] ? "done" : activeId === c.id ? "active" : ""}>
                <button type="button" className="cwp-clue" disabled={!!solvedMap[c.id]} aria-pressed={activeId === c.id} onClick={() => elegirPista(c)}>
                  <b>{c.number}.</b> {conNiebla && !solvedMap[c.id] ? "???" : c.clue} <small>({c.length})</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="cw-side-title">Pistas verticales</div>
          <ul className="cw-clue-list">
            {down.map((c) => (
              <li key={c.id} className={solvedMap[c.id] ? "done" : activeId === c.id ? "active" : ""}>
                <button type="button" className="cwp-clue" disabled={!!solvedMap[c.id]} aria-pressed={activeId === c.id} onClick={() => elegirPista(c)}>
                  <b>{c.number}.</b> {conNiebla && !solvedMap[c.id] ? "???" : c.clue} <small>({c.length})</small>
                </button>
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

// Íconos de trazo de los sabotajes (diseño "Campus": sin emojis)
const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
function IconoCongelar() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M10 2v16M3 6l14 8M17 6L3 14" {...trazo} /><path d="M8 3.5l2 1.5 2-1.5M8 16.5l2-1.5 2 1.5" {...trazo} /></svg>;
}
function IconoNiebla() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><path d="M3 7h11M5 10.5h12M3 14h10" {...trazo} /></svg>;
}
function IconoRobar() {
  return <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="7" {...trazo} /><path d="M12.2 7.6c-.5-.7-1.3-1-2.2-1-1.2 0-2.1.6-2.1 1.6 0 2.2 4.4 1.2 4.4 3.5 0 1-.9 1.7-2.3 1.7-1 0-1.9-.4-2.4-1.1M10 5.4v1.2M10 13.4v1.2" {...trazo} /></svg>;
}
