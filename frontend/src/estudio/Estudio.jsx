import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconoEnLinea } from "../campusUi";
import { conClaseDestino, limpiarClaseDestino } from "../claseDestino";
import { API_URL, getToken } from "../api";
import { socket } from "../socket";
import { Brand } from "../Brand";
import { emitConTiempoLimite, loadJSON, saveJSON } from "../cw/helpers";
import { aplicarOp } from "./model";
import { Editor } from "./Editor";
import { TeacherRoom, Miembros } from "./TeacherRoom";
import { ThemeToggle } from "./ThemeToggle";
import "./estudio.css";

const LS_DOCENTE = "yachay_es_docente"; // código de la última sala del docente
const LS_ALUMNO = "yachay_es_alumno"; // { code, studentId, name, team }

// Historial en ESTE dispositivo (sirve también sin cuenta): las últimas presentaciones que se abrieron.
// Con cuenta, además se pide al servidor, así se ve el historial desde cualquier dispositivo.
const LS_HIST = "yachay_es_historial"; // [{ code, studentId, name, roomName, deckName, teamCode, slideId, visto }]
const leerHist = () => {
  const l = loadJSON(LS_HIST);
  return Array.isArray(l) ? l.filter((x) => x && /^\d{6}$/.test(x.code || "")) : [];
};
function guardarHist(item) {
  const todo = leerHist();
  const previo = todo.find((x) => x.code === item.code);
  const nuevo = { ...previo, ...item, visto: Date.now() };
  const resto = todo.filter((x) => x.code !== item.code);
  saveJSON(LS_HIST, [nuevo, ...resto].slice(0, 20));
}
const quitarHist = (code) =>
  saveJSON(
    LS_HIST,
    leerHist().filter((x) => x.code !== code),
  );
const haceTiempo = (ms) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? "ayer" : `hace ${d} días`;
};

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
      data.error ||
        (res.status === 404
          ? "El servidor no tiene esta herramienta todavía: actualiza el backend y reinícialo."
          : "No se pudo completar la acción."),
    );
  }
  return data;
}

// ============================================================================
// PRESENTACIONES EN VIVO — punto de entrada
//   Docente  -> crea una sala y ve en vivo las presentaciones de todos
//   Alumno   -> entra con el código y crea su presentación (sola o en equipo)
// ============================================================================
export function Estudio({ user, goHome, onLogin, onRegister, initialCode = "", initialName = "" }) {
  const esDocente = user?.role === "docente";
  const [vista, setVista] = useState(() => (esDocente ? "revisando" : "join")); // revisando | salas | setup | docente | join | alumno | gate
  const [sala, setSala] = useState(null); // docente: { code, state }
  const [alumno, setAlumno] = useState(null); // alumno: { session, state }
  const [cargando, setCargando] = useState(false);

  const [salas, setSalas] = useState(null); // docente: lista de sus salas (null = aún no cargada)

  // Docente: trae la lista de todas las salas que ha creado.
  const cargarSalas = useCallback(async () => {
    const r = await pedir("/api/slides/mine");
    setSalas(r.rooms || []);
    return r.rooms || [];
  }, []);

  // Docente: si recargó la página con una sala ABIERTA, vuelve a ella; si no, ve su lista de salas
  // (o el formulario para crear la primera, si todavía no tiene ninguna).
  useEffect(() => {
    if (vista !== "revisando") return;
    let vivo = true;
    const irALista = async () => {
      try {
        const lista = await cargarSalas();
        if (vivo) setVista(lista.length ? "salas" : "setup");
      } catch {
        if (vivo) setVista("setup"); // servidor sin la lista todavía: se puede crear sala igual
      }
    };
    const code = loadJSON(LS_DOCENTE);
    if (!code) {
      irALista();
      return () => {
        vivo = false;
      };
    }
    emitConTiempoLimite("ss:watch", { code }, (ack) => {
      if (!vivo) return;
      if (ack?.ok && ack.state.status !== "closed") {
        setSala({ code, state: ack.state });
        setVista("docente");
      } else {
        saveJSON(LS_DOCENTE, null);
        irALista();
      }
    });
    return () => {
      vivo = false;
    };
  }, [vista, cargarSalas]);

  const irASalas = () => {
    saveJSON(LS_DOCENTE, null);
    setSala(null);
    setSalas(null);
    setVista("revisando");
  };

  // Docente: abre una sala de su lista (aunque ya no estuviera en memoria del servidor).
  const abrirSala = async (s) => {
    try {
      const r = await pedir(`/api/slides/mine/${encodeURIComponent(s.id)}/abrir`, { method: "POST" });
      const ack = await new Promise((res) => emitConTiempoLimite("ss:watch", { code: r.code }, res));
      if (!ack?.ok) return ack?.error || "No se pudo abrir la sala.";
      saveJSON(LS_DOCENTE, r.code);
      setSala({ code: r.code, state: ack.state });
      setVista("docente");
      return "";
    } catch (e) {
      return e.message;
    }
  };

  // Docente: elimina una sala cerrada (de la lista o desde su panel).
  const eliminarSala = async (id) => {
    try {
      await pedir(`/api/slides/mine/${encodeURIComponent(id)}`, { method: "DELETE" });
      setSalas((l) => (l ? l.filter((x) => x.id !== id) : l));
      return "";
    } catch (e) {
      return e.message;
    }
  };

  // Alumno: si ya estaba en una sala, vuelve a entrar con su mismo id.
  useEffect(() => {
    if (esDocente) return;
    const g = loadJSON(LS_ALUMNO);
    if (!g) return;
    emitConTiempoLimite("ss:join", g, (ack) => {
      if (ack?.ok) {
        setAlumno({ session: { ...g, studentId: ack.studentId }, state: ack.state });
        setVista("alumno");
      } else saveJSON(LS_ALUMNO, null);
    });
  }, []); // eslint-disable-line

  const crear = async (name, task) => {
    setCargando(true);
    try {
      const r = await pedir("/api/slides", {
        method: "POST",
        body: JSON.stringify({ name, task, ...conClaseDestino() }),
      });
      limpiarClaseDestino();
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

  const entrar = (code, name, team, teamCode, studentIdConocido) =>
    new Promise((res) => {
      const guardado =
        leerHist().find((x) => x.code === code)?.studentId ||
        (loadJSON(LS_ALUMNO)?.code === code ? loadJSON(LS_ALUMNO).studentId : undefined);
      const g = { code, studentId: studentIdConocido || guardado, name, team, teamCode };
      emitConTiempoLimite("ss:join", g, (ack) => {
        if (!ack?.ok) return res(ack?.error || "No se pudo entrar.");
        // Desde ahora se reconecta con el código del equipo (no con el nombre, que crearía otro).
        const session = { ...g, studentId: ack.studentId, team: "", teamCode: ack.state?.teamCode || "" };
        saveJSON(LS_ALUMNO, session);
        guardarHist({
          code,
          studentId: ack.studentId,
          name: ack.state?.me?.name || name,
          roomName: ack.state?.name || "",
          deckName: ack.state?.deckName || "",
          teamCode: ack.state?.teamCode || "",
        });
        setAlumno({ session, state: ack.state });
        setVista("alumno");
        res("");
      });
    });

  const salirAlumno = () => {
    saveJSON(LS_ALUMNO, null);
    setAlumno(null);
    goHome();
  };

  if (vista === "revisando")
    return (
      <Pantalla goHome={goHome}>
        <p className="es-muted">Cargando…</p>
      </Pantalla>
    );

  if (vista === "docente" && sala) {
    return (
      <TeacherRoom
        key={sala.code}
        code={sala.code}
        initial={sala.state}
        onExit={goHome}
        onNuevaSala={() => {
          saveJSON(LS_DOCENTE, null);
          setSala(null);
          setVista("setup");
        }}
        onSalas={irASalas}
        onEliminar={async () => {
          const msg = await eliminarSala(sala.state.id);
          if (!msg) irASalas();
          return msg;
        }}
      />
    );
  }
  if (vista === "salas" && salas) {
    return (
      <MisSalas
        goHome={goHome}
        salas={salas}
        onAbrir={abrirSala}
        onEliminar={eliminarSala}
        onNueva={() => setVista("setup")}
      />
    );
  }
  if (vista === "alumno" && alumno)
    return (
      <SalaAlumno key={alumno.session.code} session={alumno.session} initial={alumno.state} onSalir={salirAlumno} />
    );

  if (vista === "setup")
    return (
      <Crear
        goHome={goHome}
        cargando={cargando}
        onCrear={crear}
        onSalas={esDocente && salas?.length ? () => setVista("salas") : null}
      />
    );
  return (
    <Unirse
      goHome={goHome}
      user={user}
      initialCode={initialCode}
      initialName={initialName}
      onEntrar={entrar}
      onLogin={onLogin}
      onRegister={onRegister}
    />
  );
}

// ---------- marco simple para las pantallas de formulario ----------
function Pantalla({ goHome, extra, children }) {
  return (
    <div className="es es-page">
      <header className="es-top">
        <div className="es-top-l">
          <Brand subtitle="Presentaciones" onClick={goHome} />
        </div>
        <div className="es-top-r">
          <ThemeToggle />
          {extra}
          <button className="es-btn ghost" onClick={goHome}>
            ← Volver al inicio
          </button>
        </div>
      </header>
      <main className="es-center">{children}</main>
    </div>
  );
}

function Crear({ goHome, onCrear, cargando, onSalas }) {
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [error, setError] = useState("");
  return (
    <Pantalla
      goHome={goHome}
      extra={
        onSalas && (
          <button className="es-btn ghost" onClick={onSalas}>
            <IconoEnLinea nombre="lista" />
            Mis salas
          </button>
        )
      }
    >
      <section className="es-card-form">
        <span className="es-eyebrow">NUEVA SALA</span>
        <h1>Presentaciones en vivo</h1>
        <p className="es-muted">
          Tus estudiantes crean sus presentaciones aquí mismo, solos o en equipo, y tú las ves en tiempo real. Sin Meet
          y sin compartir pantalla.
        </p>
        <label htmlFor="es-n">Nombre de la actividad</label>
        <input
          id="es-n"
          value={name}
          maxLength={60}
          placeholder="Ej. Exposición: modelos de regresión — Sección B"
          onChange={(e) => setName(e.target.value)}
        />
        <label htmlFor="es-t">Consigna para los estudiantes (opcional)</label>
        <textarea
          id="es-t"
          value={task}
          maxLength={500}
          placeholder="Ej. En 5 diapositivas presenten el problema, el método, los resultados y una conclusión."
          onChange={(e) => setTask(e.target.value)}
        />
        {error && (
          <p className="es-err" role="alert">
            {error}
          </p>
        )}
        <button className="es-btn big" disabled={cargando} onClick={async () => setError(await onCrear(name, task))}>
          {cargando ? "Creando…" : "Crear sala"}
        </button>
      </section>
    </Pantalla>
  );
}

// ============================================================================
// DOCENTE: lista de todas las salas que ha creado
// ============================================================================
const fechaSala = (ms) =>
  new Date(ms).toLocaleString("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function MisSalas({ goHome, salas, onAbrir, onEliminar, onNueva }) {
  const [error, setError] = useState("");
  const [ocupada, setOcupada] = useState(""); // id de la sala en la que se está trabajando
  const abiertas = salas.filter((s) => s.status !== "closed").length;

  const abrir = async (s) => {
    setOcupada(s.id);
    setError("");
    const msg = await onAbrir(s);
    if (msg) {
      setError(msg);
      setOcupada("");
    }
  };
  const eliminar = async (s) => {
    if (
      !window.confirm(
        `¿Eliminar la sala «${s.name}» para siempre? Se borrarán todas las presentaciones de los estudiantes. Esta acción no se puede deshacer.`,
      )
    )
      return;
    setOcupada(s.id);
    setError("");
    const msg = await onEliminar(s.id);
    if (msg) setError(msg);
    setOcupada("");
  };

  return (
    <div className="es es-page">
      <header className="es-top">
        <div className="es-top-l">
          <Brand subtitle="Presentaciones" onClick={goHome} />
        </div>
        <div className="es-top-r">
          <ThemeToggle />
          <button className="es-btn" onClick={onNueva}>
            + Nueva sala
          </button>
          <button className="es-btn ghost" onClick={goHome}>
            ← Volver al inicio
          </button>
        </div>
      </header>
      <main className="es-wrap">
        <div className="es-list-head">
          <div>
            <span className="es-eyebrow">DOCENTE</span>
            <h1>Mis salas</h1>
            <p className="es-muted">
              {salas.length} sala{salas.length === 1 ? "" : "s"} · {abiertas} abierta{abiertas === 1 ? "" : "s"}. Las
              salas cerradas se pueden eliminar.
            </p>
          </div>
        </div>
        {error && (
          <div className="es-aviso es-aviso-box" role="alert">
            {error}
          </div>
        )}
        {salas.length === 0 && (
          <div className="es-empty">
            <img src="/condor-256.png" alt="" />
            <p>
              Ya no tienes salas.
              <br />
              Crea una nueva cuando quieras trabajar con tus estudiantes.
            </p>
            <button className="es-btn" onClick={onNueva}>
              + Nueva sala
            </button>
          </div>
        )}
        <ul className="es-salas">
          {salas.map((s) => {
            const cerrada = s.status === "closed";
            return (
              <li key={s.id} className="es-sala">
                <div className="es-sala-main">
                  <div className="es-sala-title">
                    <strong>{s.name}</strong>
                    <span className={"es-chip " + (cerrada ? "off" : "on")}>{cerrada ? "Cerrada" : "Abierta"}</span>
                  </div>
                  <div className="es-sala-meta">
                    <span>
                      Código <b className="es-sala-code">{s.code}</b>
                    </span>
                    <span>Creada {fechaSala(s.createdAt)}</span>
                    <span>
                      {s.students} alumno{s.students === 1 ? "" : "s"}
                    </span>
                    <span>
                      {s.decks} presentación{s.decks === 1 ? "" : "es"}
                    </span>
                  </div>
                  {s.task && <p className="es-sala-task">{s.task}</p>}
                </div>
                <div className="es-sala-act">
                  <button className="es-btn" disabled={!!ocupada} onClick={() => abrir(s)}>
                    {ocupada === s.id ? "Abriendo…" : cerrada ? "Ver trabajos" : "Abrir"}
                  </button>
                  {cerrada && (
                    <button className="es-btn danger" disabled={!!ocupada} onClick={() => eliminar(s)}>
                      <IconoEnLinea nombre="basura" />
                      Eliminar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

function Unirse({ goHome, user, onEntrar, onLogin, onRegister, initialCode = "", initialName = "" }) {
  const [code, setCode] = useState(
    String(initialCode || "")
      .replace(/\D/g, "")
      .slice(0, 6),
  );
  const [name, setName] = useState(initialName || user?.name || "");
  const [modo, setModo] = useState("solo"); // solo | crear | unirme
  const [team, setTeam] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const listo =
    code.length === 6 &&
    name.trim().length > 0 &&
    (modo === "solo" || (modo === "crear" && team.trim().length > 0) || (modo === "unirme" && teamCode.length === 4));

  // Historial: lo de este dispositivo + (con cuenta) lo del servidor, para retomar el trabajo en otra clase o dispositivo.
  const [local, setLocal] = useState(leerHist);
  const [delServidor, setDelServidor] = useState([]);
  const [retomando, setRetomando] = useState("");
  const [errorHist, setErrorHist] = useState("");
  useEffect(() => {
    if (!user) return undefined;
    let vivo = true;
    pedir("/api/slides/historial")
      .then((r) => vivo && setDelServidor(r.items || []))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user?.id]); // eslint-disable-line
  const historial = (() => {
    const m = new Map();
    for (const l of local) m.set(l.code, { ...l, updatedAt: l.visto });
    for (const s of delServidor) {
      const l = m.get(s.code) || {};
      m.set(s.code, { ...l, ...s, slideId: l.slideId, updatedAt: Math.max(s.updatedAt || 0, l.visto || 0) });
    }
    return [...m.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 15);
  })();
  const retomar = async (h) => {
    setRetomando(h.code);
    setErrorHist("");
    const msg = await onEntrar(h.code, h.name || name.trim() || user?.name || "Estudiante", "", "", h.studentId);
    if (msg) {
      setErrorHist(`«${h.roomName || h.code}»: ${msg}`);
      setRetomando("");
    }
  };
  const olvidar = (h) => {
    quitarHist(h.code);
    setLocal(leerHist());
    setDelServidor((l) => l.filter((x) => x.code !== h.code));
  };
  return (
    <Pantalla goHome={goHome}>
      <section className="es-card-form">
        <span className="es-eyebrow">ESTUDIANTE</span>
        <h1>Unirme a una sala</h1>
        <label htmlFor="es-c">Código de la sala</label>
        <input
          id="es-c"
          className="es-code-in"
          inputMode="numeric"
          value={code}
          maxLength={6}
          placeholder="000000"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <label htmlFor="es-nm">Tu nombre</label>
        <input
          id="es-nm"
          value={name}
          maxLength={30}
          placeholder="Ej. Andrea"
          onChange={(e) => setName(e.target.value)}
        />
        <span className="es-label" id="es-modo-lbl">
          ¿Cómo vas a trabajar?
        </span>
        <div className="es-modo" role="radiogroup" aria-labelledby="es-modo-lbl">
          {[
            ["solo", "Solo"],
            ["crear", "Crear equipo"],
            ["unirme", "Unirme a un equipo"],
          ].map(([v, t]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={modo === v}
              className={modo === v ? "on" : ""}
              onClick={() => setModo(v)}
            >
              {t}
            </button>
          ))}
        </div>
        {modo === "crear" && (
          <>
            <label htmlFor="es-tm">Nombre del equipo</label>
            <input
              id="es-tm"
              value={team}
              maxLength={30}
              placeholder="Ej. Los Cóndores"
              onChange={(e) => setTeam(e.target.value)}
            />
            <p className="es-muted">
              Al entrar verás un <b>código de equipo</b> de 4 letras: compártelo con tus compañeros para que editen
              contigo.
            </p>
          </>
        )}
        {modo === "unirme" && (
          <>
            <label htmlFor="es-tc">Código del equipo</label>
            <input
              id="es-tc"
              className="es-code-in"
              value={teamCode}
              maxLength={4}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) =>
                setTeamCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 4),
                )
              }
            />
            <p className="es-muted">Pídeselo a quien creó el equipo: lo ve arriba en su pantalla.</p>
          </>
        )}
        {error && (
          <p className="es-err" role="alert">
            {error}
          </p>
        )}
        <button
          className="es-btn big"
          disabled={!listo || busy}
          onClick={async () => {
            setBusy(true);
            setError(
              await onEntrar(code, name.trim(), modo === "crear" ? team.trim() : "", modo === "unirme" ? teamCode : ""),
            );
            setBusy(false);
          }}
        >
          {busy ? "Entrando…" : "Entrar a crear"}
        </button>
        {!user && (
          <p className="es-muted">
            ¿Eres docente?{" "}
            <button className="es-link" onClick={onLogin}>
              Inicia sesión
            </button>{" "}
            o{" "}
            <button className="es-link" onClick={onRegister}>
              crea tu cuenta
            </button>
            .
          </p>
        )}

        {historial.length > 0 && (
          <div className="es-hist">
            <h2>Mis presentaciones</h2>
            <p className="es-muted">
              Retoma tu trabajo donde lo dejaste, sin volver a escribir el código.
              {!user && " Sin cuenta, se guardan solo en este dispositivo."}
            </p>
            {errorHist && (
              <p className="es-err" role="alert">
                {errorHist}
              </p>
            )}
            <ul className="es-hist-list">
              {historial.map((h) => (
                <li key={h.code} className="es-hist-item">
                  <div className="es-hist-main">
                    <strong>{h.roomName || "Sala " + h.code}</strong>
                    <div className="es-hist-meta">
                      {h.deckName && <span>{h.deckName}</span>}
                      <span>Código {h.code}</span>
                      {h.teamCode && <span>Equipo {h.teamCode}</span>}
                      {h.slides ? (
                        <span>
                          {h.slides} diapositiva{h.slides === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {h.status === "closed" && <span>Sala cerrada (solo lectura)</span>}
                      {h.updatedAt ? <span>{haceTiempo(h.updatedAt)}</span> : null}
                    </div>
                  </div>
                  <div className="es-hist-act">
                    <button className="es-btn" disabled={!!retomando} onClick={() => retomar(h)}>
                      {retomando === h.code ? "Abriendo…" : h.status === "closed" ? "Ver" : "Retomar"}
                    </button>
                    {local.some((x) => x.code === h.code) && (
                      <button
                        className="es-btn ghost"
                        disabled={!!retomando}
                        onClick={() => olvidar(h)}
                        title="Quitar de este dispositivo"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
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
  const [room, setRoom] = useState({
    locked: initial.locked,
    status: initial.status,
    task: initial.task,
    name: initial.name,
  });
  const [conectado, setConectado] = useState(socket.connected);
  const [error, setError] = useState("");
  const deckKey = initial.deckKey;
  const guardados = useRef(0);

  // Trae la versión oficial del servidor (al reconectar o si algo no cuadró).
  const resync = useCallback(() => {
    emitConTiempoLimite(
      "ss:join",
      {
        code: session.code,
        studentId: session.studentId,
        name: session.name,
        team: session.team,
        teamCode: session.teamCode,
      },
      (ack) => {
        if (!ack?.ok) return setError(ack?.error || "");
        setDeck(ack.state.deck);
        setComments(ack.state.comments || {});
        setMembers(ack.state.members || []);
        setRoom({ locked: ack.state.locked, status: ack.state.status, task: ack.state.task, name: ack.state.name });
      },
    );
  }, [session]);

  useEffect(() => {
    const onOp = ({ op }) => setDeck((d) => aplicarOp(d, op));
    const onComment = ({ key, sid, comment }) =>
      key === deckKey && setComments((c) => ({ ...c, [sid]: [...(c[sid] || []), comment] }));
    const onMembers = ({ members }) => setMembers(members);
    const onRoom = ({ locked, status }) => setRoom((r) => ({ ...r, locked, status }));
    const volver = () => {
      setConectado(true);
      resync();
    };
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

  const onOp = useCallback(
    (op) => {
      socket.emit("ss:op", { op }, (ack) => {
        if (ack?.error) {
          setError(ack.error);
          resync();
        } // el servidor lo rechazó: volvemos a su versión
        else {
          guardados.current++;
          setError("");
        }
      });
    },
    [resync],
  );
  const onView = useCallback(
    (slideId) => {
      socket.emit("ss:view", { slideId });
      guardarHist({ code: session.code, slideId }); // para volver a la misma diapositiva al retomar
    },
    [session.code],
  );
  const slideInicial = useRef(leerHist().find((x) => x.code === session.code)?.slideId);

  const cerrada = room.status === "closed";
  const soloLectura = !conectado || room.locked || cerrada;
  const aviso = !conectado
    ? "Sin conexión: espera a que vuelva para seguir editando. Tu trabajo está guardado en el servidor."
    : cerrada
      ? "El docente cerró la sala. Puedes ver y presentar tu trabajo."
      : room.locked
        ? "El docente bloqueó la edición por ahora. Puedes mirar."
        : error;

  return (
    <div className="es es-full">
      {room.task && (
        <div className="es-consigna">
          <b>Consigna:</b> {room.task}
        </div>
      )}
      <Editor
        deck={deck}
        setDeck={setDeck}
        onOp={onOp}
        onView={onView}
        initialSlideId={slideInicial.current}
        readOnly={soloLectura}
        comments={comments}
        aviso={aviso}
        topLeft={
          <>
            <Brand subtitle={room.name} onClick={onSalir} />
            <strong className="es-title">{initial.deckName}</strong>
            {initial.teamCode && (
              <span className="es-teamcode" title="Comparte este código con tu equipo">
                Código del equipo: <b>{initial.teamCode}</b>
              </span>
            )}
            <Miembros members={members} />
          </>
        }
        topRight={
          <button
            className="es-btn ghost"
            onClick={() => {
              if (window.confirm("¿Salir? Tu trabajo queda guardado en la sala.")) onSalir();
            }}
          >
            Salir
          </button>
        }
      />
    </div>
  );
}
