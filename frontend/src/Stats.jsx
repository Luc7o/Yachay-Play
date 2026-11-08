import React, { useEffect, useState } from "react";
import { Brand } from "./Brand";
import { api } from "./api";
import "./tools.css";

const COLORES = {
  rojo: { nombre: "Rojo", hex: "#ef4444" },
  verde: { nombre: "Verde", hex: "#10b981" },
  amarillo: { nombre: "Amarillo", hex: "#eab308" },
  azul: { nombre: "Azul", hex: "#3b82f6" },
};

const fecha = (v) => {
  try {
    return new Date(v).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
};

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const MOTIVOS = { goal: "llegó a la meta", time: "se acabó el tiempo", teacher: "lo cerró el docente", completed: "completó el crucigrama" };

function Tarjeta({ titulo, valor, nota }) {
  return (
    <div className="tl-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  );
}

// ------------------------------- DOCENTE -------------------------------
function VistaDocente({ d }) {
  const { ludo, crossword } = d;
  const maxVictorias = Math.max(1, ...Object.values(ludo.winsByColor));
  return (
    <>
      <div className="tl-cards">
        <Tarjeta titulo="Partidas de Ludo" valor={ludo.total} nota={`${ludo.finished} terminadas`} />
        <Tarjeta titulo="Crucigramas" valor={crossword.total} nota={`${crossword.finished} terminados`} />
        <Tarjeta titulo="Jugadores en Ludo" valor={ludo.players} />
        <Tarjeta titulo="Jugadores en Crucigrama" valor={crossword.players} />
      </div>

      <div className="tl-grid">
        <section className="tl-box">
          <h2>🏆 Victorias por equipo (Ludo)</h2>
          {Object.keys(ludo.winsByColor).length === 0 ? (
            <p className="tl-empty">Aún no hay partidas con ganador.</p>
          ) : (
            Object.entries(COLORES).map(([k, c]) => {
              const n = ludo.winsByColor[k] || 0;
              return (
                <div className="tl-row" key={k}>
                  <span><i className="tl-dot" style={{ background: c.hex }} />{c.nombre}</span>
                  <b>{n}</b>
                  <div className="tl-bar"><i style={{ width: `${(n / maxVictorias) * 100}%`, background: c.hex }} /></div>
                </div>
              );
            })
          )}
        </section>

        <section className="tl-box">
          <h2>🧠 Preguntas que más se fallan</h2>
          {ludo.hardQuestions.length === 0 ? (
            <p className="tl-empty">Se mostrarán cuando una pregunta se haya jugado al menos 2 veces.</p>
          ) : (
            ludo.hardQuestions.map((q) => (
              <div className="tl-row" key={q.id}>
                <span>
                  <b>{q.question}</b>
                  <small>{q.topic} · {q.correct} de {q.asked} {q.asked === 1 ? "acierto" : "aciertos"}</small>
                </span>
                <span className={"tl-pill " + (q.pct < 40 ? "lose" : q.pct < 70 ? "warn" : "win")}>{q.pct}%</span>
                <div className="tl-bar"><i className={q.pct < 40 ? "bad" : q.pct < 70 ? "mid" : "good"} style={{ width: `${q.pct}%` }} /></div>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="tl-grid">
        <section className="tl-box">
          <h2>🎲 Últimas partidas de Ludo</h2>
          {ludo.recent.length === 0 ? (
            <p className="tl-empty">Todavía no has creado partidas de Ludo.</p>
          ) : (
            ludo.recent.map((g) => (
              <div className="tl-row" key={g.code}>
                <span>
                  <b>{g.name}</b>
                  <small>Código {g.code} · {fecha(g.created_at)} · {plural(g.players, "jugador", "jugadores")}{g.end_reason ? ` · ${MOTIVOS[g.end_reason]}` : ""}</small>
                </span>
                {g.phase !== "finished" ? (
                  <span className="tl-pill warn">en curso</span>
                ) : g.winner_team ? (
                  <span className="tl-pill win"><i className="tl-dot" style={{ background: COLORES[g.winner_team]?.hex, marginRight: 5 }} />{COLORES[g.winner_team]?.nombre}</span>
                ) : (
                  <span className="tl-pill">sin ganador</span>
                )}
              </div>
            ))
          )}
        </section>

        <section className="tl-box">
          <h2>🔤 Crucigramas</h2>
          {crossword.recent.length === 0 ? (
            <p className="tl-empty">Todavía no has creado crucigramas.</p>
          ) : (
            crossword.recent.map((g) => (
              <div className="tl-row" key={g.code}>
                <span>
                  <b>{g.name}</b>
                  <small>Código {g.code} · {fecha(g.created_at)} · {plural(g.players, "jugador", "jugadores")}{g.end_reason ? ` · ${MOTIVOS[g.end_reason]}` : ""}</small>
                </span>
                {g.status !== "ended" ? (
                  <span className="tl-pill warn">{g.status === "playing" ? "en juego" : "en espera"}</span>
                ) : g.winner ? (
                  <span className="tl-pill win">🏆 {g.winner}</span>
                ) : (
                  <span className="tl-pill">sin ganador</span>
                )}
              </div>
            ))
          )}
          {crossword.top.length > 0 && (
            <>
              <h3 style={{ marginTop: 14 }}>⭐ Mejores puntajes</h3>
              {crossword.top.map((p, i) => (
                <div className="tl-row" key={p.name}>
                  <span><b>{i + 1}. {p.name}</b><small>{p.games} {p.games === 1 ? "partida" : "partidas"}</small></span>
                  <span className="tl-pill">{p.best} pts</span>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  );
}

// ------------------------------ ESTUDIANTE ------------------------------
function VistaEstudiante({ d }) {
  const { summary, ludo, crossword } = d;
  const total = summary.correct + summary.incorrect;
  const pct = total ? Math.round((summary.correct / total) * 100) : 0;
  return (
    <>
      <div className="tl-cards">
        <Tarjeta titulo="Partidas jugadas" valor={summary.played} />
        <Tarjeta titulo="Partidas ganadas" valor={summary.won} />
        <Tarjeta titulo="Aciertos (Ludo)" valor={summary.correct} nota={`${summary.incorrect} fallos`} />
        <Tarjeta titulo="Precisión" valor={total ? `${pct}%` : "—"} />
      </div>
      <div className="tl-grid">
        <section className="tl-box">
          <h2>🎲 Mis partidas de Ludo</h2>
          {ludo.length === 0 ? (
            <p className="tl-empty">Aquí aparecerán las partidas que juegues con tu cuenta iniciada.</p>
          ) : (
            ludo.map((g) => {
              const gano = g.phase === "finished" && g.winner_team === g.team;
              return (
                <div className="tl-row" key={g.code + g.created_at}>
                  <span>
                    <b>{g.name}</b>
                    <small>
                      <i className="tl-dot" style={{ background: COLORES[g.team]?.hex, width: 8, height: 8 }} />
                      Equipo {COLORES[g.team]?.nombre} · {plural(g.correct, "acierto", "aciertos")}, {plural(g.incorrect, "fallo", "fallos")} · {fecha(g.created_at)}
                    </small>
                  </span>
                  {g.phase !== "finished" ? <span className="tl-pill warn">en curso</span> : gano ? <span className="tl-pill win">🏆 Ganó</span> : <span className="tl-pill">Terminó</span>}
                </div>
              );
            })
          )}
        </section>
        <section className="tl-box">
          <h2>🔤 Mis crucigramas</h2>
          {crossword.length === 0 ? (
            <p className="tl-empty">Aquí aparecerán tus crucigramas jugados con tu cuenta.</p>
          ) : (
            crossword.map((g) => (
              <div className="tl-row" key={g.code + g.created_at}>
                <span>
                  <b>{g.name}</b>
                  <small>{plural(g.solved_count, "palabra", "palabras")} · {g.score} pts · {fecha(g.created_at)}</small>
                </span>
                {g.status !== "ended" ? <span className="tl-pill warn">en curso</span> : g.won ? <span className="tl-pill win">🏆 Ganó</span> : <span className="tl-pill">Terminó</span>}
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}

export function StatsPage({ user, goHome }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .stats()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const esDocente = user?.role === "docente";
  return (
    <div className="app tl-page">
      <header className="ref-topbar">
        <Brand subtitle={esDocente ? "Estadísticas" : "Mis resultados"} onClick={goHome} />
      </header>
      <main className="tl-main">
        <button className="tl-back" onClick={goHome}>← Volver al inicio</button>
        <h1 className="tl-title">{esDocente ? "📊 Estadísticas de tus clases" : "📊 Mis resultados"}</h1>
        <p className="tl-sub">
          {esDocente
            ? "Resumen de las partidas que has creado: quién ganó, cuántos jugaron y qué preguntas cuestan más."
            : "Tu historial de partidas. Solo se guardan las que juegas con tu cuenta iniciada."}
        </p>
        {error && <div className="tl-error">{error}</div>}
        {!data && !error && <div className="tl-loading">Cargando…</div>}
        {data && (data.role === "docente" ? <VistaDocente d={data} /> : <VistaEstudiante d={data} />)}
      </main>
    </div>
  );
}
