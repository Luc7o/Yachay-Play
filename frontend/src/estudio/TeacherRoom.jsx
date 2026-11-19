import React, { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../socket";
import { emitConTiempoLimite } from "../cw/helpers";
import { Brand } from "../Brand";
import { aplicarOp } from "./model";
import { Editor } from "./Editor";
import { SlideView } from "./SlideView";
import { ThemeToggle } from "./ThemeToggle";

const hace = (ms) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  return s < 8 ? "ahora" : s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.round(s / 3600)} h`;
};
const SIN_OP = () => {};

// ============================================================================
// DOCENTE: ve en vivo TODAS las presentaciones de su sala (sin Meet ni compartir pantalla)
// ============================================================================
export function TeacherRoom({ code, initial, onExit, onNuevaSala, onSalas, onEliminar }) {
  const [room, setRoom] = useState({ name: initial.name, task: initial.task, status: initial.status, locked: initial.locked });
  const [decks, setDecks] = useState(() => new Map(initial.decks.map((d) => [d.key, d])));
  const [abierta, setAbierta] = useState(null); // deckKey que se está mirando en detalle
  const [conectado, setConectado] = useState(socket.connected);
  const [, setTic] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 5000); // refresca los "hace X s"
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const cargar = (state) => {
      setRoom({ name: state.name, task: state.task, status: state.status, locked: state.locked });
      setDecks(new Map(state.decks.map((d) => [d.key, d])));
    };
    const onStudent = ({ student, deck }) =>
      setDecks((prev) => {
        const m = new Map(prev);
        const actual = m.get(deck.key) || { ...deck, members: [] };
        const members = actual.members.filter((x) => x.id !== student.id).concat({ id: student.id, name: student.name, online: student.online, slideId: student.slideId });
        m.set(deck.key, { ...actual, ...deck, deck: m.has(deck.key) ? actual.deck : deck.deck, members });
        return m;
      });
    const onOp = ({ key, op }) =>
      setDecks((prev) => {
        const e = prev.get(key);
        if (!e) return prev;
        const m = new Map(prev);
        m.set(key, { ...e, deck: aplicarOp(e.deck, op), updatedAt: Date.now() });
        return m;
      });
    const onPresence = ({ id, deckKey, online, slideId }) =>
      setDecks((prev) => {
        const e = prev.get(deckKey);
        if (!e) return prev;
        const m = new Map(prev);
        m.set(deckKey, { ...e, members: e.members.map((x) => (x.id === id ? { ...x, online, slideId } : x)) });
        return m;
      });
    const onComment = ({ key, sid, comment }) =>
      setDecks((prev) => {
        const e = prev.get(key);
        if (!e) return prev;
        const m = new Map(prev);
        m.set(key, { ...e, comments: { ...e.comments, [sid]: [...(e.comments[sid] || []), comment] } });
        return m;
      });
    const onRoom = ({ locked, status }) => setRoom((r) => ({ ...r, locked, status }));
    const volver = () => { // tras una desconexión, pedimos todo otra vez
      setConectado(true);
      emitConTiempoLimite("ss:watch", { code }, (ack) => ack?.ok && cargar(ack.state));
    };
    const caer = () => setConectado(false);

    socket.on("ss:student", onStudent);
    socket.on("ss:op", onOp);
    socket.on("ss:presence", onPresence);
    socket.on("ss:comment", onComment);
    socket.on("ss:room", onRoom);
    socket.on("connect", volver);
    socket.on("disconnect", caer);
    return () => {
      socket.off("ss:student", onStudent);
      socket.off("ss:op", onOp);
      socket.off("ss:presence", onPresence);
      socket.off("ss:comment", onComment);
      socket.off("ss:room", onRoom);
      socket.off("connect", volver);
      socket.off("disconnect", caer);
    };
  }, [code]);

  const lista = useMemo(() => [...decks.values()].sort((a, b) => a.name.localeCompare(b.name, "es")), [decks]);
  const enLinea = lista.reduce((n, d) => n + d.members.filter((m) => m.online).length, 0);
  const totalAlumnos = lista.reduce((n, d) => n + d.members.length, 0);

  const accion = (evento, extra = {}) =>
    emitConTiempoLimite(evento, { code, ...extra }, (ack) => setError(ack?.error || ""));
  // El servidor no nos devuelve nuestro propio comentario: lo agregamos aquí cuando confirma que lo guardó.
  const enviarComentario = (key, sid, text) =>
    emitConTiempoLimite("ss:comment", { code, key, sid, text }, (a) => {
      setError(a?.error || "");
      if (!a?.ok) return;
      setDecks((prev) => {
        const e = prev.get(key);
        if (!e) return prev;
        const m = new Map(prev);
        m.set(key, { ...e, comments: { ...e.comments, [sid]: [...(e.comments[sid] || []), { text, time: Date.now() }] } });
        return m;
      });
    });
  const cerrar = () => {
    if (window.confirm("¿Cerrar la sala? Nadie más podrá entrar ni editar. Los trabajos se conservan.")) accion("ss:close");
  };
  const [eliminando, setEliminando] = useState(false);
  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar la sala «${room.name}» para siempre? Se borrarán todas las presentaciones de los estudiantes. Esta acción no se puede deshacer.`)) return;
    setEliminando(true);
    const msg = await onEliminar();
    if (msg) { setError(msg); setEliminando(false); }
  };

  // ------- detalle de una presentación -------
  const entrada = abierta ? decks.get(abierta) : null;
  if (entrada) {
    return (
      <div className="es es-full">
        <Editor
          key={entrada.key}
          deck={entrada.deck}
          setDeck={SIN_OP}
          onOp={SIN_OP}
          readOnly
          comments={entrada.comments}
          topLeft={
            <>
              <button className="es-btn ghost" onClick={() => setAbierta(null)}>← Todas</button>
              <strong className="es-title">{entrada.name}</strong>
              <Miembros members={entrada.members} />
            </>
          }
          sidebar={(slide) => <Comentar key={slide.id} onEnviar={(text) => enviarComentario(entrada.key, slide.id, text)} />}
          aviso={!conectado ? "Sin conexión con el servidor. Reconectando…" : error}
        />
      </div>
    );
  }

  return (
    <div className="es es-page">
      <header className="es-top">
        <div className="es-top-l">
          <Brand subtitle="Presentaciones" onClick={onExit} />
          <strong className="es-title">{room.name}</strong>
        </div>
        <div className="es-top-r">
          <ThemeToggle />
          <button className="es-btn ghost" onClick={onSalas}>📋 Mis salas</button>
          <button className="es-btn ghost" onClick={onExit}>← Volver al inicio</button>
        </div>
      </header>

      <main className="es-wrap">
        <section className="es-hero">
          <div>
            <span className="es-eyebrow">CÓDIGO DE LA SALA</span>
            <div className="es-code" aria-label={"Código " + code.split("").join(" ")}>{code}</div>
            <p className="es-muted">Los estudiantes entran a <b>YachayPlay → Juegos → Presentaciones</b> y escriben este código.</p>
            {room.task && <p className="es-task"><b>Consigna:</b> {room.task}</p>}
          </div>
          <div className="es-hero-act">
            <div className="es-stats">
              <div><b>{enLinea}</b><span>en línea</span></div>
              <div><b>{totalAlumnos}</b><span>alumnos</span></div>
              <div><b>{lista.length}</b><span>presentaciones</span></div>
            </div>
            <div className="es-row">
              {room.status === "closed" ? (
                <>
                  <span className="es-chip warn">Sala cerrada</span>
                  <button className="es-btn danger" onClick={eliminar} disabled={eliminando}>{eliminando ? "Eliminando…" : "🗑 Eliminar sala"}</button>
                </>
              ) : (
                <>
                  <button className="es-btn" onClick={() => accion("ss:lock", { locked: !room.locked })}>{room.locked ? "🔓 Permitir editar" : "🔒 Bloquear edición"}</button>
                  <button className="es-btn danger" onClick={cerrar}>⏹ Cerrar sala</button>
                </>
              )}
              <button className="es-btn ghost" onClick={onNuevaSala}>Nueva sala</button>
            </div>
            {room.locked && room.status !== "closed" && <span className="es-chip warn">Edición bloqueada: los estudiantes solo pueden mirar</span>}
          </div>
        </section>

        {(error || !conectado) && <div className="es-aviso" role="alert">{!conectado ? "Sin conexión con el servidor. Reconectando…" : error}</div>}

        {lista.length === 0 ? (
          <div className="es-empty">
            <img src="/mascota-explica.png" alt="" />
            <p>Esperando a los estudiantes…<br />Cuando entren, verás aquí sus presentaciones en vivo.</p>
          </div>
        ) : (
          <div className="es-grid">
            {lista.map((d) => {
              const viendo = d.members.map((m) => m.slideId).find((id) => id && d.deck.slides.some((s) => s.id === id));
              const slide = d.deck.slides.find((s) => s.id === viendo) || d.deck.slides[0];
              const nComent = Object.values(d.comments || {}).reduce((n, l) => n + l.length, 0);
              return (
                <button key={d.key} className="es-card" onClick={() => setAbierta(d.key)}>
                  <SlideView slide={slide} width={290} />
                  <div className="es-card-info">
                    <strong>{d.name}{d.teamCode && <span className="es-teamcode"> · {d.teamCode}</span>}</strong>
                    <Miembros members={d.members} />
                    <small>{d.deck.slides.length} diapositiva{d.deck.slides.length === 1 ? "" : "s"} · {hace(d.updatedAt)}{nComent ? ` · 💬 ${nComent}` : ""}</small>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export function Miembros({ members }) {
  return (
    <span className="es-miembros">
      {members.map((m) => (
        <span key={m.id} className="es-miembro" title={m.online ? "En línea" : "Desconectado"}>
          <i className={m.online ? "on" : ""} />{m.name}
        </span>
      ))}
    </span>
  );
}

function Comentar({ onEnviar }) {
  const [t, setT] = useState("");
  const [ok, setOk] = useState(false);
  return (
    <div className="es-comentar">
      <h3>✍️ Comentar esta diapositiva</h3>
      <textarea value={t} maxLength={400} placeholder="Ej. Agrega una imagen que explique mejor la idea." onChange={(e) => { setT(e.target.value); setOk(false); }} />
      <button className="es-btn" disabled={!t.trim()} onClick={() => { onEnviar(t.trim()); setT(""); setOk(true); }}>Enviar comentario</button>
      {ok && <small className="es-muted">Enviado ✓ — el estudiante lo ve al instante.</small>}
    </div>
  );
}
