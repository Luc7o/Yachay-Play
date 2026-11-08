import React, { useEffect, useState } from "react";
import { Brand } from "./Brand";
import { api } from "./api";
import "./tools.css";

const fecha = (v) => {
  try {
    return new Date(v).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

function Tarjeta({ titulo, valor, nota }) {
  return (
    <div className="tl-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {nota && <small>{nota}</small>}
    </div>
  );
}

// ------------------------- editar datos -------------------------
function EditarDatos({ user, onUserUpdate }) {
  const [nombre, setNombre] = useState(user.name);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setMsg({ tipo: "", texto: "" });
    setGuardando(true);
    try {
      const { user: u } = await api.profileName(nombre);
      onUserUpdate(u);
      setMsg({ tipo: "ok", texto: "Nombre actualizado." });
    } catch (e) {
      setMsg({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  }
  return (
    <section className="tl-box tl-form">
      <h2>✏️ Mis datos</h2>
      {msg.texto && <div className={msg.tipo === "ok" ? "tl-ok" : "tl-error"}>{msg.texto}</div>}
      <label>Nombre</label>
      <input type="text" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <label>Correo</label>
      <input type="text" value={user.email} disabled title="El correo no se puede cambiar" />
      <div className="tl-actions">
        <button className="tl-btn orange" disabled={guardando || nombre.trim() === user.name} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar nombre"}
        </button>
      </div>
    </section>
  );
}

// ------------------------- cambiar contraseña -------------------------
function CambiarClave() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setMsg({ tipo: "", texto: "" });
    if (nueva !== repetir) return setMsg({ tipo: "error", texto: "Las contraseñas nuevas no coinciden." });
    setGuardando(true);
    try {
      await api.profilePassword(actual, nueva);
      setActual("");
      setNueva("");
      setRepetir("");
      setMsg({ tipo: "ok", texto: "Contraseña cambiada." });
    } catch (e) {
      setMsg({ tipo: "error", texto: e.message });
    } finally {
      setGuardando(false);
    }
  }
  return (
    <section className="tl-box tl-form">
      <h2>🔒 Cambiar contraseña</h2>
      {msg.texto && <div className={msg.tipo === "ok" ? "tl-ok" : "tl-error"}>{msg.texto}</div>}
      <label>Contraseña actual</label>
      <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
      <label>Contraseña nueva (mínimo 6 caracteres)</label>
      <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      <label>Repite la contraseña nueva</label>
      <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
      <div className="tl-actions">
        <button className="tl-btn" disabled={guardando || !actual || !nueva} onClick={guardar}>
          {guardando ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </div>
    </section>
  );
}

// ------------------------- ranking -------------------------
function Ranking() {
  const [r, setR] = useState(null);
  useEffect(() => {
    api.profileRanking().then(setR).catch(() => setR({ total: 0, top: [], me: null }));
  }, []);
  if (!r) return <section className="tl-box"><h2>🏅 Ranking de estudiantes</h2><p className="tl-empty">Cargando…</p></section>;
  const meFuera = r.me && !r.top.some((f) => f.me);
  const fila = (f) => (
    <tr key={f.position} className={f.me ? "pf-me" : ""}>
      <td><span className={"pf-pos" + (f.position <= 3 ? ` p${f.position}` : "")}>{f.position}</span></td>
      <td><b>{f.name}</b>{f.me ? " (tú)" : ""}</td>
      <td className="num">{f.won}</td>
      <td className="num">{f.played}</td>
      <td className="num"><b>{f.points}</b></td>
    </tr>
  );
  return (
    <section className="tl-box">
      <h2>🏅 Ranking de estudiantes</h2>
      {r.top.length === 0 ? (
        <p className="tl-empty">Todavía no hay estudiantes en el ranking. Termina una partida con tu cuenta iniciada para aparecer.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="pf-table">
            <thead>
              <tr><th>#</th><th>Estudiante</th><th className="num">Victorias</th><th className="num">Partidas</th><th className="num">Puntos</th></tr>
            </thead>
            <tbody>
              {r.top.map(fila)}
              {meFuera && (
                <>
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>⋯</td></tr>
                  {fila(r.me)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="pf-note">Puntos = 10 por victoria + 2 por partida terminada. Solo cuentan partidas jugadas con tu cuenta iniciada.</p>
    </section>
  );
}

// ------------------------- página -------------------------
export function ProfilePage({ user, goHome, onUserUpdate, onOpenStats, onOpenQuestions }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.profile().then(setData).catch((e) => setError(e.message));
  }, []);

  const esDocente = user.role === "docente";
  const d = data?.docente;
  const e = data?.estudiante;
  const total = e ? e.correct + e.incorrect : 0;

  return (
    <div className="app tl-page">
      <header className="ref-topbar">
        <Brand subtitle="Mi perfil" onClick={goHome} />
      </header>
      <main className="tl-main">
        <button className="tl-back" onClick={goHome}>← Volver al inicio</button>
        {error && <div className="tl-error">{error}</div>}

        <div className="pf-head">
          <div className="pf-avatar">{user.name.trim().charAt(0).toUpperCase()}</div>
          <div className="pf-info">
            <h1>{user.name}</h1>
            <p>✉️ {user.email}</p>
            <p>
              <span className={"tl-pill " + (esDocente ? "" : "warn")}>{esDocente ? "👩‍🏫 Docente" : "🎒 Estudiante"}</span>
              {data?.user.created_at && <span style={{ marginLeft: 8 }}>Miembro desde {fecha(data.user.created_at)}</span>}
            </p>
          </div>
          {e && (
            <div className="pf-rank">
              <span>MI POSICIÓN</span>
              <strong>{e.rank ? `#${e.rank}` : "—"}</strong>
              <small>{e.rank ? `de ${e.totalRanked} estudiantes` : "juega para entrar"}</small>
            </div>
          )}
        </div>

        {!data && !error && <div className="tl-loading">Cargando…</div>}

        {d && (
          <>
            <div className="tl-cards">
              <Tarjeta titulo="Partidas de Ludo" valor={d.ludoGames} />
              <Tarjeta titulo="Crucigramas" valor={d.crosswordGames} />
              <Tarjeta titulo="Mis preguntas" valor={d.questions} />
              <Tarjeta titulo="Estudiantes con cuenta" valor={d.students} nota="que jugaron en tus partidas" />
            </div>
            <div className="pf-links" style={{ marginBottom: 16 }}>
              <button className="tl-btn ghost" onClick={onOpenStats}>📊 Ver mis estadísticas</button>
              <button className="tl-btn ghost" onClick={onOpenQuestions}>📚 Mis preguntas</button>
            </div>
          </>
        )}

        {e && (
          <>
            <div className="tl-cards">
              <Tarjeta titulo="Puntos" valor={e.points} nota="10 por victoria + 2 por partida" />
              <Tarjeta titulo="Victorias" valor={e.won} />
              <Tarjeta titulo="Partidas terminadas" valor={e.played} />
              <Tarjeta titulo="Precisión (Ludo)" valor={total ? `${Math.round((e.correct / total) * 100)}%` : "—"} nota={total ? `${e.correct} de ${total} respuestas` : ""} />
            </div>
            <section className="tl-box" style={{ marginBottom: 16 }}>
              <h2>🎖️ Mis logros ({e.badges.filter((b) => b.unlocked).length}/{e.badges.length})</h2>
              <div className="pf-badges">
                {e.badges.map((b) => (
                  <div key={b.id} className={"pf-badge " + (b.unlocked ? "on" : "off")}>
                    <i>{b.icon}</i>
                    <span><b>{b.name}</b><small>{b.desc}</small></span>
                  </div>
                ))}
              </div>
            </section>
            <div className="pf-links" style={{ marginBottom: 16 }}>
              <button className="tl-btn ghost" onClick={onOpenStats}>📊 Ver mi historial de partidas</button>
            </div>
            <div style={{ marginBottom: 16 }}><Ranking /></div>
          </>
        )}

        <div className="tl-grid">
          <EditarDatos user={user} onUserUpdate={onUserUpdate} />
          <CambiarClave />
        </div>
      </main>
    </div>
  );
}
