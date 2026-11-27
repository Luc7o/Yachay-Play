import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconoEnLinea } from "../campusUi";
import { api } from "../api";
import { socket } from "../socket";
import { useSalaEnVivo } from "../salaEnVivo";
import { conClaseDestino, limpiarClaseDestino, useClaseDestino } from "../claseDestino";
import { Hearts, PalabraStage, StageFrame, useStageTheme } from "./PalabraStage";
import { Button } from "../ui";

// ============================================================================
// PALABRA RELÁMPAGO · EN LÍNEA
// ============================================================================
// Cada persona juega desde su propio dispositivo; el servidor lleva los turnos,
// el reloj y valida las palabras. Lo pueden crear:
//   - Estudiantes (con su cuenta): para jugar entre compañeros, sin docente.
//   - Docentes: lo mismo, y además lo pueden ligar a una clase y agregar palabras
//     extra al diccionario (solo el docente puede hacerlo).
// ============================================================================

const saveKey = (code) => `yp_palabra_player_${code}`;
const readSaved = (code) => {
  try {
    return sessionStorage.getItem(saveKey(code)) || undefined;
  } catch {
    return undefined;
  }
};
const writeSaved = (code, id) => {
  try {
    sessionStorage.setItem(saveKey(code), id);
  } catch {
    /* sin almacenamiento */
  }
};

// ---------------------------------------------------------------------------
// Formularios (se muestran dentro de la tarjeta de configuración de Palabra Relámpago)
// ---------------------------------------------------------------------------
export function OnlineSetup({ user, extraWords = [], initialCode = "", initialName = "", onEnter }) {
  const esDocente = user?.role === "docente";
  const destino = useClaseDestino();
  const [codigo, setCodigo] = useState(
    String(initialCode || "")
      .replace(/\D/g, "")
      .slice(0, 6),
  );
  const [nombre, setNombre] = useState(initialName || user?.name || "");
  const [err, setErr] = useState("");
  const [crear, setCrear] = useState({
    name: "",
    mode: "individual",
    teams: 2,
    seconds: 20,
    maxRounds: 30,
    hostPlays: false,
    useExtra: true,
  });
  const [ocupado, setOcupado] = useState(false);
  const set = (k, v) => setCrear((c) => ({ ...c, [k]: v }));

  function unirse(e) {
    e.preventDefault();
    if (codigo.length !== 6) return setErr("El código tiene 6 números.");
    if (!nombre.trim()) return setErr("Escribe tu nombre.");
    setErr("");
    onEnter({ code: codigo, name: nombre.trim(), host: false, hostPlays: true });
  }

  async function crearPartida(e) {
    e.preventDefault();
    setOcupado(true);
    setErr("");
    try {
      const r = await api.palabraCreate({
        name: crear.name,
        mode: crear.mode,
        teams: crear.teams,
        seconds: crear.seconds,
        maxRounds: crear.maxRounds,
        hostPlays: esDocente ? crear.hostPlays : true,
        extraWords: esDocente && crear.useExtra ? extraWords : [],
        ...conClaseDestino(),
      });
      limpiarClaseDestino();
      onEnter({ code: r.code, name: user.name, host: true, hostPlays: r.hostPlays });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pr-online">
      <form onSubmit={unirse} className="pr-online-box">
        <h3>Unirme a una partida</h3>
        <p className="pr-small">Pide el código de 6 números a quien creó la partida.</p>
        <label>
          Código
          <input
            className="pr-name-input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            value={codigo}
            maxLength={6}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </label>
        <label>
          Tu nombre
          <input
            className="pr-name-input"
            value={nombre}
            maxLength={30}
            autoComplete="name"
            placeholder="Ej. Andrea"
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <Button size="lg" type="submit">
          Unirme →
        </Button>
      </form>

      <form onSubmit={crearPartida} className="pr-online-box">
        <h3>Crear una partida</h3>
        {!user ? (
          <p className="pr-small">Inicia sesión para crear una partida y compartir su código con tus compañeros.</p>
        ) : (
          <>
            <p className="pr-small">
              {esDocente
                ? destino
                  ? `Se creará dentro de la clase «${destino.name}» y tus estudiantes la verán en vivo.`
                  : "Tus estudiantes se unen con el código. Si la lanzas desde una clase, les aparece en vivo."
                : "Comparte el código con tus compañeros: juegan entre ustedes, sin docente."}
            </p>
            <label>
              Nombre de la partida (opcional)
              <input
                className="pr-name-input"
                value={crear.name}
                maxLength={60}
                placeholder="Ej. Repaso de vocabulario"
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <div className="pr-mode" role="group" aria-label="Modalidad de la partida">
              <button
                type="button"
                className={crear.mode === "individual" ? "chosen" : ""}
                onClick={() => set("mode", "individual")}
              >
                <IconoEnLinea nombre="persona" />
                Cada quien por su cuenta
              </button>
              <button
                type="button"
                className={crear.mode === "equipos" ? "chosen" : ""}
                onClick={() => set("mode", "equipos")}
              >
                <IconoEnLinea nombre="grupo" />
                Por equipos
              </button>
            </div>
            <div className="pr-config">
              <label>
                Tiempo por turno
                <select value={crear.seconds} onChange={(e) => set("seconds", Number(e.target.value))}>
                  <option value={15}>15 segundos</option>
                  <option value={20}>20 segundos</option>
                  <option value={30}>30 segundos</option>
                </select>
              </label>
              <label>
                Turnos máximos
                <select value={crear.maxRounds} onChange={(e) => set("maxRounds", Number(e.target.value))}>
                  <option value={12}>12 turnos</option>
                  <option value={30}>30 turnos</option>
                  <option value={60}>60 turnos</option>
                  <option value={100}>100 turnos</option>
                </select>
              </label>
            </div>
            {crear.mode === "equipos" && (
              <label>
                Número de equipos
                <select value={crear.teams} onChange={(e) => set("teams", Number(e.target.value))}>
                  <option value={2}>2 equipos</option>
                  <option value={3}>3 equipos</option>
                  <option value={4}>4 equipos</option>
                </select>
              </label>
            )}
            {esDocente && (
              <>
                <label className="pr-check">
                  <input
                    type="checkbox"
                    checked={crear.hostPlays}
                    onChange={(e) => set("hostPlays", e.target.checked)}
                  />{" "}
                  Yo también quiero jugar (si no, solo controlas y proyectas la partida)
                </label>
                {extraWords.length > 0 && (
                  <label className="pr-check">
                    <input
                      type="checkbox"
                      checked={crear.useExtra}
                      onChange={(e) => set("useExtra", e.target.checked)}
                    />{" "}
                    Incluir mi diccionario personalizado ({extraWords.length.toLocaleString("es")} palabras)
                  </label>
                )}
              </>
            )}
            <p className="pr-small">
              3 vidas por participante · +10 puntos y el tiempo restante por acierto · Sin palabras repetidas.
            </p>
            <Button size="lg" type="submit" disabled={ocupado}>
              {ocupado ? "Creando…" : "Crear partida →"}
            </Button>
          </>
        )}
      </form>
      {err && (
        <div className="pr-alert pr-online-err" role="alert">
          {err}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sala en vivo
// ---------------------------------------------------------------------------
export function OnlineRoom({ code, name, host, hostPlays, onExit }) {
  const [theme, toggleTheme] = useStageTheme();
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [typing, setTyping] = useState({ n: 0, text: "" });
  const [localMsg, setLocalMsg] = useState(null);
  const [offset, setOffset] = useState(0); // diferencia entre el reloj del servidor y el de este dispositivo
  const [, setNow] = useState(0);
  const inputRef = useRef(null);
  const turnRef = useRef(0);

  const onlyWatches = host && !hostPlays;

  const entrar = useCallback(() => {
    const evento = onlyWatches ? "pr:watch" : "pr:join";
    socket.emit(evento, { code, name, playerId: readSaved(code) }, (r) => {
      if (r?.error) return setError(r.error);
      if (r.playerId) writeSaved(code, r.playerId);
      setError("");
      setOffset(r.state.now - Date.now());
      setState(r.state);
    });
  }, [code, name, onlyWatches]);

  useSalaEnVivo({
    clave: entrar,
    eventos: {
      "pr:state": (s) => {
        setOffset(s.now - Date.now());
        setState(s);
      },
      "pr:typing": (t) => setTyping(t),
    },
    alReconectar: entrar, // si se cae la conexión, se vuelve a entrar con el mismo jugador
  });
  useEffect(() => {
    if (socket.connected) entrar();
    else socket.connect();
  }, [entrar]);

  // Reloj local para que los segundos bajen suave entre mensajes del servidor.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Cada turno nuevo: se limpia la respuesta y quien tiene el turno enfoca el campo.
  const turnN = state?.turn?.n || 0;
  const miTurno = !!state?.me && state?.turn?.playerId === state.me.id && state.status === "turn";
  useEffect(() => {
    if (turnN === turnRef.current) return;
    turnRef.current = turnN;
    setAnswer("");
    setLocalMsg(null);
    setTyping({ n: turnN, text: "" });
  }, [turnN]);
  useEffect(() => {
    if (miTurno) inputRef.current?.focus();
  }, [miTurno, turnN]);

  const salir = () => {
    if (state?.status === "lobby" && !onlyWatches) socket.emit("pr:leave", {}, () => {});
    onExit();
  };
  const accion = (evento, extra = {}) =>
    socket.emit(evento, extra, (r) => r?.error && setLocalMsg({ text: r.error, tone: "bad" }));

  if (error) {
    return (
      <StageFrame
        theme={theme}
        onToggleTheme={toggleTheme}
        onExit={onExit}
        exitLabel="Volver"
        title="Palabra Relámpago"
        kicker="EN LÍNEA"
      >
        <div className="pf-center">
          <section className="pf-card">
            <h2>No pudimos entrar</h2>
            <p className="pf-err" role="alert">
              {error}
            </p>
            <Button onClick={onExit}>Volver</Button>
          </section>
        </div>
      </StageFrame>
    );
  }
  if (!state) {
    return (
      <StageFrame
        theme={theme}
        onToggleTheme={toggleTheme}
        onExit={onExit}
        exitLabel="Volver"
        title="Palabra Relámpago"
        kicker="EN LÍNEA"
      >
        <div className="pf-center">
          <section className="pf-card">
            <p>Conectando con la partida…</p>
          </section>
        </div>
      </StageFrame>
    );
  }

  const me = state.me;
  const marco = {
    theme,
    onToggleTheme: toggleTheme,
    onExit: salir,
    title: state.name,
    kicker: "PALABRA RELÁMPAGO · EN LÍNEA",
  };

  // ------------------------------- sala de espera -------------------------------
  if (state.status === "lobby") {
    const nombresDe = (id) => state.players.filter((p) => p.team === id);
    return (
      <StageFrame {...marco} exitLabel="Salir">
        <div className="pf-center">
          <section className="pf-card">
            <span className="pf-kicker">SALA DE ESPERA</span>
            <h2>{state.name}</h2>
            <p>Comparte este código con quienes van a jugar:</p>
            <div className="pf-bigcode" aria-label={`Código ${state.code.split("").join(" ")}`}>
              {state.code}
            </div>
            <p>
              {state.mode === "equipos" ? "Por equipos" : "Cada quien por su cuenta"} · {state.seconds} s por turno · 3
              vidas · hasta {state.maxRounds} turnos
              {state.extraCount > 0 ? ` · ${state.extraCount} palabras extra del docente` : ""}
            </p>

            {state.mode === "equipos" ? (
              <div className="pf-teams">
                {state.teams.map((t) => (
                  <div className="pf-team" key={t.id} style={{ "--c": t.color }}>
                    <h3>
                      {t.name}
                      <span>{nombresDe(t.id).length}</span>
                    </h3>
                    <ul>
                      {nombresDe(t.id).map((p) => (
                        <li key={p.id}>
                          {p.name}
                          {p.id === me?.id ? " (tú)" : ""}
                        </li>
                      ))}
                    </ul>
                    {me && (
                      <Button
                        variant={me.team === t.id ? "primary" : "ghost"}
                        onClick={() => accion("pr:team", { team: t.id })}
                      >
                        {me.team === t.id ? "Estás aquí" : "Unirme"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="pf-people" aria-label="Jugadores en la sala">
                {state.players.length === 0 ? (
                  <p>Todavía no se une nadie.</p>
                ) : (
                  state.players.map((p) => (
                    <span className="pf-word" key={p.id}>
                      {p.name}
                      {p.id === me?.id ? " (tú)" : ""}
                    </span>
                  ))
                )}
              </div>
            )}
            {state.mode === "equipos" && state.players.some((p) => !p.team) && (
              <p>Quien no elija equipo entrará al que tenga menos integrantes.</p>
            )}
            {localMsg && (
              <p className="pf-err" role="alert">
                {localMsg.text}
              </p>
            )}
            <div className="pf-actions">
              {state.isHost ? (
                <Button onClick={() => accion("pr:start")} disabled={state.players.length < 2}>
                  {state.players.length < 2 ? "Esperando jugadores (mínimo 2)" : "Empezar partida"}
                </Button>
              ) : (
                <p>
                  Esperando a que <strong>{state.hostName || "quien creó la partida"}</strong> empiece…
                </p>
              )}
            </div>
          </section>
        </div>
      </StageFrame>
    );
  }

  // --------------------------------- final ---------------------------------
  if (state.status === "ended") {
    const lider = state.ranking?.[0];
    const empate = (state.ranking || []).filter((r) => r.score === lider?.score).length > 1;
    return (
      <StageFrame {...marco} exitLabel="Volver">
        <div className="pf-center">
          <section className="pf-card">
            <div style={{ fontSize: 54 }} aria-hidden="true">
              <IconoEnLinea nombre="trofeo" />
            </div>
            <h2>¡Partida terminada!</h2>
            {lider && (
              <p>
                {empate ? "Empate en el primer lugar" : "Ganador"}:{" "}
                <strong>
                  {(state.ranking || [])
                    .filter((r) => r.score === lider.score)
                    .map((r) => r.name)
                    .join(" y ")}
                </strong>{" "}
                · {lider.score} puntos
              </p>
            )}
            <div>
              {(state.ranking || []).map((r) => (
                <div key={r.id} className={"pf-rank" + (r.rank === 1 ? " pf-first" : "")}>
                  <span>{r.rank}.</span>
                  <span>
                    {r.name} <Hearts lives={r.lives} />
                  </span>
                  <strong>
                    {r.score} pts · {r.words} {r.words === 1 ? "palabra" : "palabras"}
                  </strong>
                </div>
              ))}
            </div>
            <div className="pf-actions">
              <Button onClick={onExit}>Volver a juegos</Button>
            </div>
          </section>
        </div>
      </StageFrame>
    );
  }

  // ------------------------------ partida en curso ------------------------------
  const t = state.turn;
  const servidorAhora = Date.now() + offset;
  const remain = Math.max(0, Math.ceil(((t?.deadline || servidorAhora) - servidorAhora) / 1000));
  const enResultado = state.status === "result";
  const r = state.lastResult;
  const equipoTurno = state.entities.find((e) => e.id === t?.entityId);
  const tengoTurno = miTurno;

  let mensaje = localMsg;
  if (enResultado && r) {
    mensaje = r.ok
      ? { text: `✔ ${r.playerName}: «${r.word}» · +${r.points} puntos`, tone: "good" }
      : {
          text: `${r.reason === "skip" ? "Pasó el turno" : "Se acabó el tiempo"} · ${r.entityName} pierde una vida${r.eliminated ? " y queda eliminado" : ""}`,
          tone: "bad",
        };
  }
  const visto = tengoTurno ? answer : typing.n === t?.n ? typing.text : t?.typing || "";

  const status = enResultado
    ? `Ronda ${state.round} de ${state.maxRounds}`
    : tengoTurno
      ? `¡Es tu turno${state.mode === "equipos" ? ` · ${equipoTurno?.name}` : ""}!`
      : `Turno de ${t?.playerName}${state.mode === "equipos" ? ` · ${equipoTurno?.name}` : ""} · Ronda ${state.round} de ${state.maxRounds}`;

  return (
    <PalabraStage
      {...marco}
      exitLabel="Salir"
      status={status}
      fragment={t?.fragment || "··"}
      clock={{
        remain: enResultado ? 0 : remain,
        total: state.seconds,
        low: !enResultado && remain <= 5,
        boom: enResultado && !!r && !r.ok,
      }}
      entry={{
        editable: tengoTurno,
        value: visto,
        placeholder: tengoTurno ? undefined : "Esperando la respuesta…",
        onChange: (v) => {
          setAnswer(v);
          socket.emit("pr:typing", { text: v });
        },
        onSubmit: () => {
          if (!tengoTurno || !answer.trim()) return;
          socket.emit(
            "pr:submit",
            { word: answer },
            (res) => res?.error && setLocalMsg({ text: res.error, tone: "bad" }),
          );
        },
        inputRef,
      }}
      message={mensaje}
      actions={
        tengoTurno ? (
          <Button variant="ghost" onClick={() => accion("pr:skip")}>
            Pasar turno (−1 vida)
          </Button>
        ) : state.isHost && onlyWatches ? (
          <Button variant="ghost" onClick={() => window.confirm("¿Terminar la partida ahora?") && accion("pr:end")}>
            Terminar partida
          </Button>
        ) : null
      }
      side={
        <>
          <h2>
            <IconoEnLinea nombre="trofeo" />
            Clasificación
          </h2>
          {[...state.entities]
            .sort((a, b) => b.score - a.score || b.lives - a.lives)
            .map((e) => (
              <div
                key={e.id}
                className={"pf-row" + (e.id === t?.entityId ? " pf-turn" : "") + (e.lives === 0 ? " pf-out" : "")}
                style={{ "--c": e.color }}
              >
                <span className="pf-dot" />
                <span className="pf-row-name">
                  {e.name}
                  {e.id === me?.id || e.id === me?.team ? " (tú)" : ""}
                  {state.mode === "equipos" && <small>{e.members.join(", ")}</small>}
                </span>
                <span className="pf-row-pts">
                  {e.score} pts
                  <small>
                    <Hearts lives={e.lives} />
                  </small>
                </span>
              </div>
            ))}
        </>
      }
      used={state.used.map((u) => ({ word: u.word, by: u.by, color: u.color }))}
    />
  );
}
