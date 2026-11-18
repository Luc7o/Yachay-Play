import React, { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, getToken } from "../api";
import { socket } from "../socket";
import { Brand } from "../Brand";
import { emitConTiempoLimite, loadJSON, saveJSON } from "../cw/helpers";
import { aplicarOp } from "./model";
import { Editor } from "./Editor";
import { TeacherRoom, Miembros } from "./TeacherRoom";
import "./estudio.css";

const LS_DOCENTE = "yachay_es_docente"; // código de la última sala del docente
const LS_ALUMNO = "yachay_es_alumno"; // { code, studentId, name, team }

async function pedir(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa que el backend esté encendido.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error || (res.status === 404 ? "El servidor no tiene esta herramienta todavía: actualiza el backend y reinícialo." : "No se pudo completar la acción.")
    );
  }
  return data;
}

// ============================================================================
// PRESENTACIONES EN VIVO — punto de entrada
//   Docente  -> crea una sala y ve en vivo las presentaciones de todos
//   Alumno   -> entra con el código y crea su presentación (sola o en equipo)
// ============================================================================
export function Estudio({ user, goHome, onLogin, onRegister }) {
  const esDocente = user?.role === "docente";
  const [vista, setVista] = useState(() => (esDocente ? "revisando" : "join")); // revisando | setup | docente | join | alumno | gate
  const [sala, setSala] = useState(null); // docente: { code, state }
  const [alumno, setAlumno] = useState(null); // alumno: { session, state }
  const [cargando, setCargando] = useState(false);

  // Docente: si ya tenía una sala abierta (recargó la página), la recuperamos.
  useEffect(() => {
    if (vista !== "revisando") return;
    const code = loadJSON(LS_DOCENTE);
    if (!code) return setVista("setup");
    emitConTiempoLimite("ss:watch", { code }, (ack) => {
      if (ack?.ok) { setSala({ code, state: ack.state }); setVista("docente"); }
      else { saveJSON(LS_DOCENTE, null); setVista("setup"); }
    });
  }, [vista]);

  // Alumno: si ya estaba en una sala, vuelve a entrar con su mismo id.
  useEffect(() => {
    if (esDocente) return;
    const g = loadJSON(LS_ALUMNO);
    if (!g) return;
    emitConTiempoLimite("ss:join", g, (ack) => {
      if (ack?.ok) { setAlumno({ session: { ...g, studentId: ack.studentId }, state: ack.state }); setVista("alumno"); }
      else saveJSON(LS_ALUMNO, null);
    });
  }, []); // eslint-disable-line

  const crear = async (name, task) => {
    setCargando(true);
    try {
      const r = await pedir("/api/slides", { method: "POST", body: JSON.stringify({ name, task }) });
      const ack = await new Promise((res) => emitConTiempoLimite("ss:watch", { code: r.code }, res));
      if (!ack?.ok) throw new Error(ack?.error || "No se pudo abrir la sala.");
      saveJSON(LS_DOCENTE, r.code);
      setSala({ code: r.code, state: ack.state });
      setVista("docente");
      return "";
    } catch (e) {
      return e.message;
    } finally {
      setCargando(false);
    }
  };

  const entrar = (code, name, team) =>
    new Promise((res) => {
      const g = { code, studentId: loadJSON(LS_ALUMNO)?.code === code ? loadJSON(LS_ALUMNO).studentId : undefined, name, team };
      emitConTiempoLimite("ss:join", g, (ack) => {
        if (!ack?.ok) return res(ack?.error || "No se pudo entrar.");
        const session = { ...g, studentId: ack.studentId };
        saveJSON(LS_ALUMNO, session);
        setAlumno({ session, state: ack.state });
        setVista("alumno");
        res("");
      });
    });

  const salirAlumno = () => { saveJSON(LS_ALUMNO, null); setAlumno(null); goHome(); };

  if (vista === "revisando") return <Pantalla goHome={goHome}><p className="es-muted">Cargando…</p></Pantalla>;

  if (vista === "docente" && sala) {
    return (
      <TeacherRoom
        key={sala.code}
        code={sala.code}
        initial={sala.state}
        onExit={goHome}
        onNuevaSala={() => { saveJSON(LS_DOCENTE, null); setSala(null); setVista("setup"); }}
      />
    );
  }
  if (vista === "alumno" && alumno) return <SalaAlumno key={alumno.session.code} session={alumno.session} initial={alumno.state} onSalir={salirAlumno} />;

  if (vista === "setup") return <Crear goHome={goHome} cargando={cargando} onCrear={crear} />;
  return <Unirse goHome={goHome} user={user} onEntrar={entrar} onLogin={onLogin} onRegister={onRegister} />;
}

// ---------- marco simple para las pantallas de formulario ----------
function Pantalla({ goHome, children }) {
  return (
    <div className="es es-page">
      <header className="es-top">
        <div className="es-top-l"><Brand subtitle="Presentaciones" onClick={goHome} /></div>
        <div className="es-top-r"><button className="es-btn ghost" onClick={goHome}>← Volver al inicio</button></div>
      </header>
      <main className="es-center">{children}</main>
    </div>
  );
}

function Crear({ goHome, onCrear, cargando }) {
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [error, setError] = useState("");
  return (
    <Pantalla goHome={goHome}>
      <section className="es-card-form">
        <span className="es-eyebrow">NUEVA SALA</span>
        <h1>Presentaciones en vivo</h1>
        <p className="es-muted">Tus estudiantes crean sus presentaciones aquí mismo, solos o en equipo, y tú las ves en tiempo real. Sin Meet y sin compartir pantalla.</p>
        <label htmlFor="es-n">Nombre de la actividad</label>
        <input id="es-n" value={name} maxLength={60} placeholder="Ej. Exposición de animales — 3.º A" onChange={(e) => setName(e.target.value)} />
        <label htmlFor="es-t">Consigna para los estudiantes (opcional)</label>
        <textarea id="es-t" value={task} maxLength={500} placeholder="Ej. Presenta un animal en 5 diapositivas: dónde vive, qué come y un dato curioso." onChange={(e) => setTask(e.target.value)} />
        {error && <p className="es-err" role="alert">{error}</p>}
        <button className="es-btn big" disabled={cargando} onClick={async () => setError(await onCrear(name, task))}>{cargando ? "Creando…" : "Crear sala"}</button>
      </section>
    </Pantalla>
  );
}

function Unirse({ goHome, user, onEntrar, onLogin, onRegister }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(user?.name || "");
  const [team, setTeam] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const listo = code.length === 6 && name.trim().length > 0;
  return (
    <Pantalla goHome={goHome}>
      <section className="es-card-form">
        <span className="es-eyebrow">ESTUDIANTE</span>
        <h1>Unirme a una sala</h1>
        <label htmlFor="es-c">Código de la sala</label>
        <input id="es-c" className="es-code-in" inputMode="numeric" value={code} maxLength={6} placeholder="000000" onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        <label htmlFor="es-nm">Tu nombre</label>
        <input id="es-nm" value={name} maxLength={30} placeholder="Ej. Andrea" onChange={(e) => setName(e.target.value)} />
        <label htmlFor="es-tm">Nombre de tu equipo (opcional)</label>
        <input id="es-tm" value={team} maxLength={30} placeholder="Déjalo vacío para trabajar solo" onChange={(e) => setTeam(e.target.value)} />
        <p className="es-muted">Si varios escriben <b>el mismo nombre de equipo</b>, editan la misma presentación al mismo tiempo.</p>
        {error && <p className="es-err" role="alert">{error}</p>}
        <button className="es-btn big" disabled={!listo || busy} onClick={async () => { setBusy(true); setError(await onEntrar(code, name.trim(), team.trim())); setBusy(false); }}>
          {busy ? "Entrando…" : "Entrar a crear"}
        </button>
        {!user && (
          <p className="es-muted">¿Eres docente? <button className="es-link" onClick={onLogin}>Inicia sesión</button> o <button className="es-link" onClick={onRegister}>crea tu cuenta</button>.</p>
        )}
      </section>
    </Pantalla>
  );
}

// ============================================================================
// ESTUDIANTE: editor conectado a la sala
// ============================================================================
function SalaAlumno({ session, initial, onSalir }) {
  const [deck, setDeck] = useState(initial.deck);
  const [comments, setComments] = useState(initial.comments || {});
  const [members, setMembers] = useState(initial.members || []);
  const [room, setRoom] = useState({ locked: initial.locked, status: initial.status, task: initial.task, name: initial.name });
  const [conectado, setConectado] = useState(socket.connected);
  const [error, setError] = useState("");
  const deckKey = initial.deckKey;
  const guardados = useRef(0);

  // Trae la versión oficial del servidor (al reconectar o si algo no cuadró).
  const resync = useCallback(() => {
    emitConTiempoLimite("ss:join", { code: session.code, studentId: session.studentId, name: session.name, team: session.team }, (ack) => {
      if (!ack?.ok) return setError(ack?.error || "");
      setDeck(ack.state.deck);
      setComments(ack.state.comments || {});
      setMembers(ack.state.members || []);
      setRoom({ locked: ack.state.locked, status: ack.state.status, task: ack.state.task, name: ack.state.name });
    });
  }, [session]);

  useEffect(() => {
    const onOp = ({ op }) => setDeck((d) => aplicarOp(d, op));
    const onComment = ({ key, sid, comment }) => key === deckKey && setComments((c) => ({ ...c, [sid]: [...(c[sid] || []), comment] }));
    const onMembers = ({ members }) => setMembers(members);
    const onRoom = ({ locked, status }) => setRoom((r) => ({ ...r, locked, status }));
    const volver = () => { setConectado(true); resync(); };
    const caer = () => setConectado(false);
    socket.on("ss:op", onOp);
    socket.on("ss:comment", onComment);
    socket.on("ss:members", onMembers);
    socket.on("ss:room", onRoom);
    socket.on("connect", volver);
    socket.on("disconnect", caer);
    return () => {
      socket.off("ss:op", onOp);
      socket.off("ss:comment", onComment);
      socket.off("ss:members", onMembers);
      socket.off("ss:room", onRoom);
      socket.off("connect", volver);
      socket.off("disconnect", caer);
    };
  }, [deckKey, resync]);

  const onOp = useCallback((op) => {
    socket.emit("ss:op", { op }, (ack) => {
      if (ack?.error) { setError(ack.error); resync(); } // el servidor lo rechazó: volvemos a su versión
      else { guardados.current++; setError(""); }
    });
  }, [resync]);
  const onView = useCallback((slideId) => socket.emit("ss:view", { slideId }), []);

  const cerrada = room.status === "closed";
  const soloLectura = !conectado || room.locked || cerrada;
  const aviso = !conectado
    ? "Sin conexión: espera a que vuelva para seguir editando. Tu trabajo está guardado en el servidor."
    : cerrada
    ? "El docente cerró la sala. Puedes ver y presentar tu trabajo."
    : room.locked
    ? "🔒 El docente bloqueó la edición por ahora. Puedes mirar."
    : error;

  return (
    <div className="es es-full">
      {room.task && <div className="es-consigna"><b>Consigna:</b> {room.task}</div>}
      <Editor
        deck={deck}
        setDeck={setDeck}
        onOp={onOp}
        onView={onView}
        readOnly={soloLectura}
        comments={comments}
        aviso={aviso}
        topLeft={
          <>
            <Brand subtitle={room.name} onClick={onSalir} />
            <strong className="es-title">{initial.deckName}</strong>
            <Miembros members={members} />
          </>
        }
        topRight={<button className="es-btn ghost" onClick={() => { if (window.confirm("¿Salir? Tu trabajo queda guardado en la sala.")) onSalir(); }}>Salir</button>}
      />
    </div>
  );
}
