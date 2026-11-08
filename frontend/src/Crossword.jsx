import React, { useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "./Brand";
import { api } from "./api";
import { socket } from "./socket";
import { GameGate, CrosswordPreview, CrosswordSabotagesExtra } from "./GameGate";

// ============================================================================
// CRUCIGRAMA RELÁMPAGO — juego nuevo de YachayPlay
// ============================================================================
// Todo el juego vive en este único archivo, aparte del Ludo, para no
// arriesgar nada de lo que ya funciona. Usa el mismo socket compartido
// (los eventos empiezan con "cw:" para no chocar con los de Ludo "engineer:").
//
// Tableros individuales iguales: todos reciben el MISMO crucigrama, pero cada
// quien lo llena por su cuenta (es una carrera). El servidor nunca manda las
// respuestas de un rival, solo su % de avance y su puntaje.
// ============================================================================

const LS_STUDENT = "yachay_cw_student"; // { code, playerId } — para reconectar si recarga la página
const LS_TEACHER = "yachay_cw_teacher_code"; // código de la última sala creada por este docente

function loadJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function saveJSON(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado del navegador: no pasa nada, solo no recuerda entre recargas */
  }
}

// El servidor SIEMPRE responde a estos mensajes (ack), pero si el backend no
// tiene esta parte del código (versión vieja o sin reiniciar), o si algo se
// corta a medio camino, esa respuesta nunca llega y la app se queda
// esperando en silencio para siempre. Con esto, si no hay respuesta en unos
// segundos, se avisa con un error en vez de quedarse "Creando…" sin fin.
function emitConTiempoLimite(event, payload, callback, timeoutMs = 8000) {
  let resuelto = false;
  const avisoTardio = setTimeout(() => {
    if (resuelto) return;
    resuelto = true;
    callback?.({
      error:
        "El servidor no respondió a tiempo. Revisa que el backend esté encendido y actualizado (reinícialo si acabas de aplicar cambios) e inténtalo de nuevo.",
    });
  }, timeoutMs);
  socket.emit(event, payload, (ack) => {
    if (resuelto) return; // ya se disparó el aviso por tardanza; esta respuesta llegó demasiado tarde
    resuelto = true;
    clearTimeout(avisoTardio);
    callback?.(ack);
  });
}

function mmss(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Grupo de botones para elegir un valor (mismo patrón que en la configuración de Ludo)
const Step = ({ n, t, d }) => (
  <div className="preview-step">
    <b>{n}</b>
    <div>
      <strong>{t}</strong>
      <p>{d}</p>
    </div>
  </div>
);

function Options({ value, options, onChange, format }) {
  return (
    <div className="cfg-chips" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          role="radio"
          aria-checked={o === value}
          className={"cfg-chip" + (o === value ? " on" : "")}
          onClick={() => onChange(o)}
        >
          {format ? format(o) : o}
        </button>
      ))}
    </div>
  );
}

// Si App.jsx pasa `frame`, la configuración del docente se muestra dentro del menú lateral.
const conMarco = (frame, pagina) => (frame ? frame(pagina) : pagina);

export function CrosswordGame({ user, onLogin, onRegister, goHome, initialCode = "", onGuestCode, frame }) {
  // Si ya hay sesión, arrancamos directo en la pantalla de su rol (sin pasar
  // primero por "gate"): así no se alcanza a ver un parpadeo de esa pantalla
  // antes de que el useEffect de abajo la cambie.
  const [view, setView] = useState(() =>
    initialCode
      ? "student-join" // llegó con un código (acceso de invitado): directo a unirse
      : user?.role === "docente" ? "teacher-setup" : user?.role === "estudiante" ? "student-join" : "gate"
  ); // gate | teacher-setup | teacher-room | student-join | student-room
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [live, setLive] = useState(null); // último cw:state recibido
  const [myId, setMyId] = useState(null);
  const [solvedMap, setSolvedMap] = useState({}); // placementId -> palabra (para dibujar el tablero)
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState([]); // avisos de sabotajes, se borran solos

  // Reloj interno: para las cuentas regresivas (tiempo, congelado, niebla, enfriamiento).
  // Solo debe correr en las pantallas que en verdad muestran algo en vivo: si
  // corriera también en "configuración" o "unirse", repintaría esas pantallas
  // 2 veces por segundo sin necesidad (eso era lo que causaba el parpadeo y
  // no dejaba escribir con comodidad en los formularios).
  useEffect(() => {
    if (view !== "teacher-room" && view !== "student-room") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [view]);

  // --- si el docente ya tenía una sala creada (recargó la página), la recupera ---
  // Se ejecuta una sola vez al montar (por eso el "ref", no depende de `view`,
  // que ya arrancó en la pantalla correcta gracias al useState de arriba).
  const yaRevisoReconexion = useRef(false);
  useEffect(() => {
    if (yaRevisoReconexion.current || user?.role !== "docente") return;
    yaRevisoReconexion.current = true;
    const codigoGuardado = loadJSON(LS_TEACHER);
    if (!codigoGuardado) return; // ya está en "teacher-setup" por el estado inicial
    setCode(codigoGuardado);
    emitConTiempoLimite("cw:watch-room", { code: codigoGuardado }, (ack) => {
      if (ack?.ok) {
        setLive(ack.state);
        setView("teacher-room");
      } else {
        saveJSON(LS_TEACHER, null);
        setView("teacher-setup");
      }
    });
  }, [user]);

  // --- reconectar como estudiante tras recargar la página ---
  useEffect(() => {
    const guardado = loadJSON(LS_STUDENT);
    if (!guardado || view !== "student-join") return;
    socket.emit(
      "cw:join-room",
      { code: guardado.code, playerId: guardado.playerId, name: user?.name || "" },
      (ack) => {
        if (ack?.ok) {
          setMyId(ack.playerId);
          setCode(guardado.code);
          setLive(ack.state);
          setView("student-room");
        } else {
          saveJSON(LS_STUDENT, null);
        }
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- escuchar el estado en vivo del servidor ---
  useEffect(() => {
    function onState(payload) {
      setLive(payload);
      if (payload.me?.solvedWords) {
        setSolvedMap((prev) => {
          const next = { ...prev };
          for (const w of payload.me.solvedWords) next[w.placementId] = w.word;
          return next;
        });
      }
    }
    function onSabotage(r) {
      const soyYo = r.targetId === myId;
      const fuiYo = r.sourceId === myId;
      const label = { freeze: "te congeló", fog: "te puso niebla", steal: "te robó puntos" }[r.type];
      const labelYo = { freeze: "Congelaste a", fog: "Le pusiste niebla a", steal: "Le robaste puntos a" }[r.type];
      const nombre = (id) => live?.leaderboard?.find((p) => p.id === id)?.name || "alguien";
      let texto = null;
      if (soyYo) texto = `⚠️ ${nombre(r.sourceId)} ${label}`;
      else if (fuiYo) texto = `${labelYo} ${nombre(r.targetId)}` + (r.stolen ? ` (+${r.stolen} pts)` : "");
      if (texto) {
        const id = Math.random();
        setToasts((t) => [...t, { id, texto }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
      }
    }
    socket.on("cw:state", onState);
    socket.on("cw:sabotage-used", onSabotage);
    return () => {
      socket.off("cw:state", onState);
      socket.off("cw:sabotage-used", onSabotage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, live?.leaderboard]);

  function volverAlCatalogo() {
    saveJSON(LS_TEACHER, null);
    saveJSON(LS_STUDENT, null);
    goHome();
  }

  if (view === "gate") {
    return (
      <CwGate
        onLogin={onLogin}
        onRegister={onRegister}
        onGuest={() => (onGuestCode ? onGuestCode() : setView("student-join"))}
        onBack={goHome}
      />
    );
  }

  if (view === "teacher-setup") {
    return conMarco(
      frame,
      <CwTeacherSetup
        goHome={volverAlCatalogo}
        error={error}
        onCreate={(name, minutes, wordCount) => {
          setError("");
          api
            .crosswordCreate(name, minutes, wordCount)
            .then((r) => {
              setCode(r.code);
              saveJSON(LS_TEACHER, r.code);
              emitConTiempoLimite("cw:watch-room", { code: r.code }, (ack) => {
                if (ack?.ok) {
                  setLive(ack.state);
                  setView("teacher-room");
                } else setError(ack?.error || "No se pudo abrir la sala.");
              });
            })
            .catch((e) => setError(e.message));
        }}
      />
    );
  }

  if (view === "teacher-room") {
    return (
      <CwTeacherRoom
        code={code}
        live={live}
        now={now}
        goHome={volverAlCatalogo}
        onStart={() => emitConTiempoLimite("cw:start", { code }, (ack) => ack?.error && setError(ack.error))}
        onEnd={() => {
          if (!window.confirm("¿Finalizar la partida ahora mismo para todos? Verán los resultados de inmediato.")) return;
          emitConTiempoLimite("cw:end", { code }, (ack) => ack?.error && setError(ack.error));
        }}
        onReset={() => {
          if (!window.confirm("Esto pone el marcador de todos en cero y los regresa a la sala de espera (el código sigue siendo el mismo). ¿Continuar?")) return;
          emitConTiempoLimite("cw:reset", { code }, (ack) => ack?.error && setError(ack.error));
        }}
        onNewGame={() => {
          saveJSON(LS_TEACHER, null);
          setLive(null);
          setError("");
          setView("teacher-setup");
        }}
        error={error}
      />
    );
  }

  if (view === "student-join") {
    return (
      <CwStudentJoin
        goHome={goHome}
        prefillName={user?.name || ""}
        initialCode={initialCode}
        error={error}
        onJoin={(codigo, name) => {
          setError("");
          emitConTiempoLimite("cw:join-room", { code: codigo, name }, (ack) => {
            if (ack?.ok) {
              setMyId(ack.playerId);
              setCode(codigo);
              saveJSON(LS_STUDENT, { code: codigo, playerId: ack.playerId });
              setLive(ack.state);
              setView("student-room");
            } else setError(ack?.error || "No se pudo unir a la partida.");
          });
        }}
      />
    );
  }

  if (view === "student-room") {
    return (
      <CwStudentRoom
        live={live}
        now={now}
        myId={myId}
        code={code}
        solvedMap={solvedMap}
        toasts={toasts}
        goHome={volverAlCatalogo}
        onSubmit={(placementId, guess, cb) =>
          emitConTiempoLimite("cw:submit", { placementId, guess }, (ack) => cb(ack))
        }
        onSabotage={(targetId, type, cb) =>
          emitConTiempoLimite("cw:sabotage", { targetId, type }, (ack) => cb(ack))
        }
      />
    );
  }

  return null;
}

// ============================================================================
// PUERTA DE ENTRADA (sin cuenta): igual de espíritu que la de Ludo, pero
// pensada para cualquier juego nuevo, no solo para Ludo.
// ============================================================================
function CwGate({ onLogin, onRegister, onGuest, onBack }) {
  return (
    <GameGate
      theme="crossword"
      subtitle="Crucigrama Relámpago"
      eyebrow="JUEGO · CRUCIGRAMA RELÁMPAGO"
      title={<>Compite llenando el crucigrama <span className="gate-hl">antes que tus rivales</span></>}
      description={
        <>
          Todos reciben el mismo crucigrama y compiten por terminarlo primero. Acertar rápido y en racha
          junta energía para lanzar <b>sabotajes</b> a tus rivales: congélalos, ponles niebla o róbales puntos.
          Si nadie lo completa, gana quien tenga más puntos.
        </>
      }
      tags={["🏁 Carrera individual", "⚡ Sabotajes", "📱 Desde el celular", "🏆 Ranking en vivo"]}
      stats={[
        { value: "6–20", label: "palabras por partida" },
        { value: "3–20", label: "minutos de duración" },
        { value: "3", label: "sabotajes para usar" },
      ]}
      mascot={{
        src: "/mascota-gana.png",
        alt: "Mascota de YachayPlay, un dragón andino con chullo, celebrando con un trofeo",
      }}
      preview={<CrosswordPreview />}
      loginPoints={[
        "Los docentes crean el crucigrama y proyectan el código",
        "Los estudiantes entran y compiten en vivo",
        "Tu rol ya está guardado",
      ]}
      registerPoints={[
        "Gratis y en menos de un minuto",
        "Eliges si eres docente o estudiante, una sola vez",
        "No necesitas instalar nada",
      ]}
      guestText="¿Solo quieres unirte con el código de tu docente?"
      steps={[
        { icon: "🖥️", t: "El docente crea la partida", d: "Elige cuántas palabras y cuánto dura, y proyecta el código de 6 dígitos." },
        { icon: "📱", t: "Los estudiantes se unen", d: "Cada uno entra desde su celular con el código y escribe su nombre." },
        { icon: "✏️", t: "Resuelven las pistas", d: "Cada quien llena su propio tablero. Acertar rápido y en racha suma puntos y energía." },
        { icon: "🏆", t: "Completa y gana", d: "Gana quien complete todo el crucigrama primero. Si se acaba el tiempo, gana quien tenga más puntos." },
      ]}
      extra={<CrosswordSabotagesExtra />}
      onLogin={onLogin}
      onRegister={onRegister}
      onGuest={onGuest}
      onBack={onBack}
    />
  );
}

// ============================================================================
// DOCENTE: crear la partida
// ============================================================================
function CwTeacherSetup({ goHome, onCreate, error }) {
  const [name, setName] = useState("Reto de Inventos");
  const [minutes, setMinutes] = useState(8);
  const [wordCount, setWordCount] = useState(12);
  const [creating, setCreating] = useState(false);
  // Si algo salió mal (código repetido, backend caído, respuesta demasiado
  // tardía...) el botón debe volver a activarse para poder reintentar, en
  // vez de quedarse diciendo "Creando…" para siempre.
  useEffect(() => {
    if (error) setCreating(false);
  }, [error]);

  function crear() {
    setCreating(true);
    onCreate(name, minutes, wordCount);
  }

  return (
    <div className="app cfg-page">
      <header className="ref-topbar">
        <Brand subtitle="Crucigrama Relámpago · Configuración" onClick={goHome} />
      </header>
      <main className="cfg-main">
        <div className="cfg-form">
          <button className="back-link" onClick={goHome}>← Volver al inicio</button>
          <span className="hero-eyebrow">PANEL DEL DOCENTE · CRUCIGRAMA RELÁMPAGO</span>
          <h1 className="cfg-title">Crear un crucigrama en vivo</h1>
          <p className="cfg-lead">Todos tus estudiantes recibirán el mismo crucigrama y competirán por terminarlo.</p>

          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">1</span>
              <div><h2>Nombre de la partida</h2><p>Así la verán tus estudiantes al entrar.</p></div>
            </div>
            <input className="cfg-input" value={name} maxLength={60} placeholder="Ej. Reto de Inventos" onChange={(e) => setName(e.target.value)} />
          </section>

          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">2</span>
              <div><h2>Cuántas palabras</h2><p>Más palabras = partida más larga y más cruces en el tablero.</p></div>
            </div>
            <Options value={wordCount} options={[6, 8, 10, 12, 15, 20]} onChange={setWordCount} format={(n) => `${n} palabras`} />
          </section>

          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">3</span>
              <div><h2>Duración</h2><p>Cuando se acabe el tiempo, la partida termina para todos.</p></div>
            </div>
            <Options value={minutes} options={[3, 5, 8, 10, 15, 20]} onChange={setMinutes} format={(n) => `${n} min`} />
          </section>
        </div>

        <aside className="cfg-side">
          <div className="cfg-guide">
            <img src="/mascota-explica.png" alt="" />
            <p>¡Ya casi! Revisa el resumen y crea tu crucigrama.</p>
          </div>

          <div className="cfg-summary">
            <span className="preview-badge">RESUMEN</span>
            <h2>{name.trim() || "Sin nombre todavía"}</h2>
            <dl className="cfg-sum-list">
              <div><dt>Palabras</dt><dd>{wordCount}</dd></div>
              <div><dt>Duración</dt><dd>{minutes} min</dd></div>
              <div><dt>Sabotajes</dt><dd>🧊 🌫️ 💰</dd></div>
            </dl>
            {!name.trim() && <p className="join-error">Escribe un nombre para la partida.</p>}
            {error && <p className="join-error">{error}</p>}
            <button className="cfg-create" disabled={creating || !name.trim()} onClick={crear}>
              {creating ? "Creando…" : "Crear crucigrama ⚡"}
            </button>
            <p className="cfg-note">Se generará un código de 6 dígitos para que tus estudiantes se unan desde el celular.</p>
          </div>

          <div className="cfg-how">
            <h3>Así funcionará</h3>
            <Step n="1" t="Compartes el código" d="Tus estudiantes entran desde su celular con este código." />
            <Step n="2" t="Cada quien responde a su ritmo" d="Mismo crucigrama para todos, tableros separados." />
            <Step n="3" t="Ganan energía por racha" d="Y la usan para sabotear a un rival: congelar, niebla o robar puntos." />
          </div>
        </aside>
      </main>
    </div>
  );
}

// ============================================================================
// DOCENTE: sala (espera → en curso → resultados), todo según live.status
// ============================================================================
function CwTeacherRoom({ code, live, now, goHome, onStart, onEnd, onReset, onNewGame, error }) {
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
              <h1 className="cfg-title">⏱️ {mmss(live.endsAt - now)}</h1>
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

// ============================================================================
// DOCENTE: vista en vivo mientras se juega
// ============================================================================
// En vez de solo un marcador, el docente ve el propio tablero (sin letras,
// nadie ve las respuestas), pintado como "mapa de calor": mientras más
// estudiantes ya resolvieron una palabra, más oscura se ve esa zona. Junto a
// eso, la lista de pistas con cuántos ya la acertaron (para detectar cuál
// está costando más) y estadísticas rápidas del grupo.
// ============================================================================
// Color del "mapa de calor" de una celda según qué % de estudiantes ya
// resolvieron la palabra que la cruza: naranja mientras va avanzando,
// verde cuando TODOS ya la tienen.
// Color de cada celda del tablero del docente, según cuántos ya la resolvieron:
//   nadie          -> blanco (el CSS por defecto de .cw-cell)
//   algunos no todos -> gris (en progreso, sin revelar nada)
//   TODOS          -> verde (ahí sí se revela la letra, ver revealedWord)
function heatColor(pct) {
  if (!pct) return undefined;
  if (pct >= 1) return "rgba(16,185,129,0.82)"; // verde: ya la resolvieron todos
  return "rgba(100,116,139,0.55)"; // gris: en progreso (todavía no se revela nada)
}

function CwTeacherLive({ live, ended }) {
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

      {!ended && (
        <>
          <div className="cw-side-title">Marcador en vivo</div>
          <CwLeaderboard board={board} />
        </>
      )}
    </div>
  );
}

// Fila de eventos: sabotajes, quién se unió, quién terminó... para que el
// docente vea qué está pasando sin tener que adivinar por qué cambió el marcador.
function CwActivityLog({ log }) {
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

function CwClueProgress({ c, total }) {
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

function CwLeaderboard({ board, showMedals }) {
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

// ============================================================================
// ESTUDIANTE: unirse con el código
// ============================================================================
function CwStudentJoin({ goHome, prefillName, onJoin, error, initialCode = "" }) {
  const [codeInput, setCodeInput] = useState(initialCode);
  const [name, setName] = useState(prefillName);
  const listo = codeInput.trim().length === 6 && name.trim().length > 0;

  return (
    <div className="app join-page">
      <header className="ref-topbar"><Brand subtitle="Crucigrama Relámpago" onClick={goHome} /></header>
      <main className="join-main">
        <aside className="join-guide">
          <img src="/mascota-explica.png" alt="" />
          <p>¡Escribe el código de tu docente y prepárate para competir!</p>
        </aside>
        <section className="join-card">
          <span className="hero-eyebrow">CRUCIGRAMA RELÁMPAGO</span>
          <h1>Unirme al reto</h1>
          <label className="join-label" htmlFor="cw-code"><span className="cfg-num">1</span> Código de partida</label>
          <input
            id="cw-code"
            className="join-code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
          />
          <label className="join-label" htmlFor="cw-name"><span className="cfg-num">2</span> Tu nombre</label>
          <input id="cw-name" className="join-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Ej. Andrea" />
          {error && <p className="join-error">{error}</p>}
          <button className="join-btn" disabled={!listo} onClick={() => onJoin(codeInput, name)}>
            ¡Entrar a competir! ⚡
          </button>
          <button className="back-link" onClick={goHome}>← Volver al inicio</button>
        </section>
      </main>
    </div>
  );
}

// ============================================================================
// ESTUDIANTE: sala (espera → jugando → resultados)
// ============================================================================
function CwStudentRoom({ live, now, myId, code, solvedMap, toasts, goHome, onSubmit, onSabotage }) {
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

function CwBoardPlay({ live, now, myId, solvedMap, toasts, goHome, onSubmit, onSabotage }) {
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

        <aside className="cw-side-col">
          <div className="cw-energy">
            <span>⚡ Energía</span>
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

// Ícono de un mini-crucigrama para el catálogo y la puerta de entrada
export function CwGridIcon() {
  return (
    <svg viewBox="0 0 100 100" className="game-icon-svg" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="10" fill="#023A73" />
      {[
        [1, 0], [2, 0], [3, 0],
        [1, 1], [3, 1],
        [0, 2], [1, 2], [2, 2], [3, 2],
        [1, 3],
      ].map(([cx, cy], i) => (
        <rect key={i} x={14 + cx * 20} y={14 + cy * 20} width="18" height="18" rx="3" fill="#fff" />
      ))}
      <rect x={14 + 1 * 20} y={14 + 0 * 20} width="18" height="18" rx="3" fill="#F16503" />
    </svg>
  );
}
