import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { socket } from "./socket";
import { RING, START_INDEX, HOME_COLUMNS, SAFE_INDEXES, cellForStep, cellKey, GOAL_STEP } from "./board";

const COLORS = {
  rojo: { name: "Rojo", hex: "#ef4444", soft: "#fee2e2" },
  verde: { name: "Verde", hex: "#10b981", soft: "#d1fae5" },
  amarillo: { name: "Amarillo", hex: "#eab308", soft: "#fef3c7" },
  azul: { name: "Azul", hex: "#3b82f6", soft: "#dbeafe" },
};
const TURN_ORDER = ["rojo", "verde", "amarillo", "azul"];
// Marca de versión visible en la pantalla de inicio (footer). Sirve para
// confirmar de un vistazo si el navegador está sirviendo esta versión o una
// vieja en caché.
const BUILD_VERSION = "2026-09-16-3";

function App() {
  const [mode, setMode] = useState(() => localStorage.getItem("ludo_mode") || null);
  const [tab, setTab] = useState("game");
  const [selected, setSelected] = useState(null);
  const [bank, setBank] = useState([]);

  // --- Ingeniero: configuración inicial ---
  const [gameName, setGameName] = useState("Historia de la Ingeniería");
  const [counts, setCounts] = useState({ rojo: 1, verde: 1, amarillo: 1, azul: 0 }); // 0 = ese color no juega
  const [minutes, setMinutes] = useState(30); // duración de la partida
  const [answerSeconds, setAnswerSeconds] = useState(20); // segundos para responder
  const [rollSeconds, setRollSeconds] = useState(15); // segundos para lanzar el dado
  const [setupError, setSetupError] = useState("");
  const [engineerGameCode, setEngineerGameCode] = useState(() => localStorage.getItem("ludo_engineer_code") || "");

  // --- Estudiante: ingreso ---
  const [joinCode, setJoinCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentTeam, setStudentTeam] = useState("rojo");
  const [playerId, setPlayerId] = useState(() => localStorage.getItem("ludo_player_id") || null);
  const [studentGameCode, setStudentGameCode] = useState(() => localStorage.getItem("ludo_game_code") || "");
  const [joinError, setJoinError] = useState("");
  const [gameInfo, setGameInfo] = useState(null); // datos de la partida antes de unirse
  const [connError, setConnError] = useState(""); // "la partida ya no existe", etc.

  const gameCode = mode === "student" ? studentGameCode : engineerGameCode;

  // --- Estado compartido recibido del servidor ---
  const [serverState, setServerState] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(null);
  const [phaseSeconds, setPhaseSeconds] = useState(null);

  // Leer parámetros de la URL (para el enlace/QR que reciben los estudiantes)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    const roleParam = params.get("role");
    if (codeParam) setJoinCode(codeParam);
    if (roleParam === "student" && !mode) setMode("student");
  }, []); // eslint-disable-line

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/questions`)
      .then((r) => r.json())
      .then(setBank)
      .catch(() => {});
  }, []);

  // Suscripción a los eventos de socket
  useEffect(() => {
    function onState(s) {
      setConnError("");
      setServerState(s);
      // Antes esto solo se actualizaba la PRIMERA vez ("prev === null"), así que
      // cuando el docente sumaba/restaba tiempo con los botones +1m/-1m/+5m, el
      // número en pantalla no cambiaba hasta que el reloj general empezara a
      // correr. Ahora se sincroniza siempre con lo que diga el servidor.
      setTimerSeconds(s.timerSeconds);
      setPhaseSeconds(s.phaseSecondsLeft);
      if (s.turnPhase !== "question") setSelected(null);
    }
    function onTimer(t) {
      setTimerSeconds(t);
    }
    // El servidor avisa cada segundo cuánto le queda a la fase actual del turno
    function onPhaseTimer({ seconds }) {
      setPhaseSeconds(seconds);
    }
    // ¡Esto faltaba! Si el servidor dice "Partida no encontrada" el alumno se
    // quedaba en "Conectando…" para siempre sin saber por qué.
    function onErrorMessage(msg) {
      setConnError(msg || "No se pudo conectar con la partida");
    }
    socket.on("error-message", onErrorMessage);
    socket.on("state", onState);
    socket.on("timer", onTimer);
    socket.on("phase-timer", onPhaseTimer);
    return () => {
      socket.off("error-message", onErrorMessage);
      socket.off("state", onState);
      socket.off("timer", onTimer);
      socket.off("phase-timer", onPhaseTimer);
    };
  }, []);

  // Unirse a la sala de socket cada vez que tengamos un código de partida
  useEffect(() => {
    if (gameCode) socket.emit("join-room", { code: gameCode });
  }, [gameCode]);

  // Cuando el alumno termina de escribir el código, buscamos la partida para
  // mostrarle SOLO los colores que realmente juegan y cuáles tienen cupo.
  useEffect(() => {
    const code = joinCode.trim();
    if (mode !== "student" || playerId || code.length !== 6) {
      setGameInfo(null);
      return;
    }
    let cancelado = false;
    api
      .getGame(code)
      .then((info) => !cancelado && setGameInfo(info))
      .catch(() => !cancelado && setGameInfo(null));
    return () => {
      cancelado = true;
    };
  }, [joinCode, mode, playerId]);

  // Si el color elegido deja de tener cupo, saltamos al primero disponible
  useEffect(() => {
    if (!gameInfo) return;
    const libres = gameInfo.activeTeams.filter(
      (t) => gameInfo.players.filter((p) => p.team === t).length < gameInfo.teams[t].slots
    );
    if (libres.length && !libres.includes(studentTeam)) setStudentTeam(libres[0]);
  }, [gameInfo]); // eslint-disable-line

  function chooseMode(m) {
    setMode(m);
    localStorage.setItem("ludo_mode", m);
  }

  function changeDevice() {
    localStorage.removeItem("ludo_mode");
    localStorage.removeItem("ludo_player_id");
    localStorage.removeItem("ludo_game_code");
    localStorage.removeItem("ludo_engineer_code");
    setMode(null);
    setServerState(null);
    setPlayerId(null);
    setStudentGameCode("");
    setEngineerGameCode("");
  }

  const [creating, setCreating] = useState(false);
  async function createGame() {
    if (creating) return; // evita doble clic mientras se espera al servidor
    setCreating(true);
    setSetupError("");
    try {
      const { code } = await api.createGame(gameName, counts, { minutes, answerSeconds, rollSeconds });
      setEngineerGameCode(code);
      localStorage.setItem("ludo_engineer_code", code);
    } catch (e) {
      setSetupError(e.message || "No se pudo crear la partida. Revisa que el backend esté corriendo.");
    } finally {
      setCreating(false);
    }
  }

  async function submitJoin() {
    setJoinError("");
    try {
      const { playerId: pid } = await api.joinGame(joinCode.trim(), studentName.trim(), studentTeam);
      setPlayerId(pid);
      setStudentGameCode(joinCode.trim());
      localStorage.setItem("ludo_player_id", pid);
      localStorage.setItem("ludo_game_code", joinCode.trim());
    } catch (e) {
      setJoinError(e.message);
    }
  }

  function startGame() {
    socket.emit("engineer:start-game", { code: gameCode });
  }
  function toggleTimer() {
    socket.emit("engineer:toggle-timer", { code: gameCode });
  }
  // El DOCENTE ya no lanza el dado ni pasa de turno: el servidor lo hace solo.
  // Esto queda solo como válvula de escape si un turno se traba.
  function skipTurn() {
    socket.emit("engineer:skip-turn", { code: gameCode });
  }
  // El ALUMNO lanza el dado desde su celular
  function playerRollDice() {
    socket.emit("player:roll-dice", { code: gameCode, playerId });
  }
  function endGame() {
    socket.emit("engineer:end-game", { code: gameCode });
  }
  // El docente suma o resta tiempo al reloj de la partida (en segundos)
  function addTime(seconds) {
    socket.emit("engineer:add-time", { code: gameCode, seconds });
  }
  // Devuelve el reloj a la duración elegida al crear la partida
  function resetTimer() {
    socket.emit("engineer:reset-timer", { code: gameCode });
  }
  // ADMIN: vuelve a crear la partida con el MISMO código. Los alumnos
  // conectados no tienen que volver a ingresar; solo se reinicia todo.
  function resetGame() {
    if (!window.confirm("¿Reiniciar la partida? Se borran fichas, puntajes e historial (los alumnos siguen conectados).")) return;
    socket.emit("engineer:reset-game", { code: gameCode });
  }
  // ADMIN: cierra esta partida y vuelve a la pantalla de configuración
  // para crear una partida nueva, con código nuevo.
  function newGame() {
    if (!window.confirm("¿Crear una partida totalmente nueva? Se generará otro código y los alumnos deberán volver a ingresar.")) return;
    socket.emit("engineer:end-game", { code: gameCode });
    localStorage.removeItem("ludo_engineer_code");
    setEngineerGameCode("");
    setServerState(null);
    setTimerSeconds(null);
  }
  function submitAnswer(index) {
    if (selected !== null || !playerId) return;
    setSelected(index);
    socket.emit("team:answer", { code: gameCode, playerId, optionIndex: index });
  }

  const connectedByTeam = useMemo(() => {
    const r = { rojo: 0, verde: 0, amarillo: 0, azul: 0 };
    if (serverState) serverState.players.forEach((p) => (r[p.team] = (r[p.team] || 0) + 1));
    return r;
  }, [serverState]);

  // ---------------- Enrutamiento por pantallas ----------------

  if (!mode) return <ChooserScreen onChoose={chooseMode} />;

  if (mode === "engineer") {
    if (!gameCode) {
      return (
        <SetupScreen
          gameName={gameName}
          setGameName={setGameName}
          counts={counts}
          setCounts={setCounts}
          minutes={minutes}
          setMinutes={setMinutes}
          answerSeconds={answerSeconds}
          setAnswerSeconds={setAnswerSeconds}
          rollSeconds={rollSeconds}
          setRollSeconds={setRollSeconds}
          createGame={createGame}
          setupError={setupError}
          creating={creating}
        />
      );
    }
    if (!serverState) return <LoadingScreen code={gameCode} error={connError} onReset={changeDevice} />;

    if (serverState.phase === "lobby") {
      return (
        <LobbyScreen
          gameName={serverState.name}
          gameCode={gameCode}
          teams={serverState.teams}
          activeTeams={serverState.activeTeams}
          connectedByTeam={connectedByTeam}
          startGame={startGame}
          newGame={newGame}
          changeDevice={changeDevice}
        />
      );
    }

    if (serverState.phase === "finished") {
      return (
        <FinishedScreen
          teams={serverState.teams}
          gameName={serverState.name}
          winner={serverState.winner}
          activeTeams={serverState.activeTeams}
          isEngineer
          resetGame={resetGame}
          newGame={newGame}
          changeDevice={changeDevice}
        />
      );
    }

    return (
      <EngineerGame
        tab={tab}
        setTab={setTab}
        serverState={serverState}
        timerSeconds={timerSeconds}
        phaseSeconds={phaseSeconds}
        toggleTimer={toggleTimer}
        addTime={addTime}
        resetTimer={resetTimer}
        skipTurn={skipTurn}
        endGame={endGame}
        resetGame={resetGame}
        newGame={newGame}
        positions={serverState.positions}
        bank={bank}
        changeDevice={changeDevice}
      />
    );
  }

  // mode === "student"
  if (!playerId) {
    return (
      <StudentJoin
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        studentName={studentName}
        setStudentName={setStudentName}
        studentTeam={studentTeam}
        setStudentTeam={setStudentTeam}
        submitJoin={submitJoin}
        joinError={joinError}
        gameInfo={gameInfo}
      />
    );
  }
  if (!serverState) return <LoadingScreen code={gameCode} error={connError} onReset={changeDevice} />;

  if (serverState.phase === "lobby") {
    return (
      <StudentWaiting
        gameCode={gameCode}
        studentName={studentName}
        studentTeam={studentTeam}
        changeDevice={changeDevice}
      />
    );
  }

  if (serverState.phase === "finished") {
    return (
      <FinishedScreen
        teams={serverState.teams}
        gameName={serverState.name}
        winner={serverState.winner}
        activeTeams={serverState.activeTeams}
        changeDevice={changeDevice}
      />
    );
  }

  return (
    <StudentGame
      serverState={serverState}
      playerId={playerId}
      selected={selected}
      phaseSeconds={phaseSeconds}
      positions={serverState.positions}
      submitAnswer={submitAnswer}
      rollDice={playerRollDice}
      changeDevice={changeDevice}
    />
  );
}

// ==================== Pantallas comunes ====================

function ChooserScreen({ onChoose }) {
  return (
    <div className="app setup-page">
      <header className="ref-topbar">
        <div className="ref-brand">
          <span className="brand-icon">🎲</span>
          <div>
            <h1>Ludo Educativo</h1>
            <p>Inventos Históricos de la Ingeniería</p>
          </div>
        </div>
      </header>
      <main className="setup-main">
        <section className="setup-welcome">
          <span className="eyebrow">¿CÓMO VAS A USAR ESTA PANTALLA?</span>
          <h1>Elige tu rol</h1>
          <p>El docente usa una computadora conectada al proyector. Los estudiantes usan su propio celular.</p>
          <div className="setup-teams">
            <button className="create-ref" onClick={() => onChoose("engineer")}>
              🖥️ Soy el docente (proyector)
            </button>
            <button className="ref-secondary" onClick={() => onChoose("student")}>
              📱 Soy estudiante (celular)
            </button>
          </div>
        </section>
      </main>
      <footer className="build-mark">Build {BUILD_VERSION}</footer>
    </div>
  );
}

function LoadingScreen({ code, error, onReset }) {
  if (error) {
    return (
      <div className="app student-lobby">
        <main className="student-page">
          <div className="phone-card">
            <span className="eyebrow">LUDO EDUCATIVO</span>
            <div className="join-success error">!</div>
            <h1>No se pudo entrar</h1>
            <p className="join-error">{error}</p>
            <p className="muted">
              La partida <b>{code}</b> ya no existe. Pide el código nuevo al docente y vuelve a ingresar.
            </p>
            <button className="create-ref" onClick={onReset}>
              Volver a ingresar
            </button>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="app student-lobby">
      <main className="student-page">
        <div className="phone-card">
          <span className="eyebrow">LUDO EDUCATIVO</span>
          <h1>Conectando…</h1>
          <p className="muted">Sincronizando con la partida {code}.</p>
        </div>
      </main>
    </div>
  );
}

function FinishedScreen({ teams, gameName, winner, activeTeams = TURN_ORDER, isEngineer, resetGame, newGame, changeDevice }) {
  const equipos = activeTeams.length ? activeTeams : TURN_ORDER;
  const ranking = [...equipos].sort((a, b) => teams[b].score - teams[a].score);
  // Si alguien llegó a la META gana por tablero; si no, gana el de más puntos.
  const champion = winner || ranking[0];
  return (
    <div className="app reference-theme">
      <header className="ref-topbar">
        <div className="ref-brand">
          <span className="brand-icon">🏁</span>
          <div>
            <h1>Ludo Educativo: Inventos Históricos de la Ingeniería</h1>
            <p>Partida finalizada • {gameName}</p>
          </div>
        </div>
        <div className="ref-controls">
          {isEngineer && (
            <>
              <button className="ref-green" onClick={resetGame}>
                🔄 Reiniciar partida
              </button>
              <button className="ref-yellow" onClick={newGame}>
                ➕ Crear partida nueva
              </button>
            </>
          )}
          <button className="ref-secondary small" onClick={changeDevice}>
            Volver al inicio
          </button>
        </div>
      </header>
      <main className="ref-content">
        <div className="ref-card wide finished-card">
          <span className="eyebrow">RESULTADOS FINALES</span>
          <h1>
            🏆 Equipo {COLORS[champion].name} gana la partida
          </h1>
          <p className="muted">
            {winner
              ? "Llegó a la META con una de sus fichas."
              : "Ganó por puntaje acumulado (nadie llegó a la meta)."}
          </p>
          <div className="score-grid finished-grid">
            {ranking.map((t, i) => (
              <div className="score-card" key={t} style={{ borderTopColor: COLORS[t].hex }}>
                <span>
                  #{i + 1} {COLORS[t].name}
                </span>
                <strong>{teams[t].score} / 20</strong>
                <small>
                  {teams[t].correct} correctas • {teams[t].incorrect} incorrectas
                </small>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ==================== Pantallas del docente ====================

function SetupScreen({
  gameName,
  setGameName,
  counts,
  setCounts,
  minutes,
  setMinutes,
  answerSeconds,
  setAnswerSeconds,
  rollSeconds,
  setRollSeconds,
  createGame,
  setupError,
  creating,
}) {
  // Un color con 0 alumnos simplemente NO JUEGA
  const activos = TURN_ORDER.filter((t) => counts[t] > 0);
  const totalStudents = TURN_ORDER.reduce((a, t) => a + counts[t], 0);
  const puedeCrear = activos.length >= 2 && gameName.trim().length > 0;

  return (
    <div className="app setup-page">
      <header className="ref-topbar">
        <div className="ref-brand">
          <span className="brand-icon">🎲</span>
          <div>
            <h1>Ludo Educativo</h1>
            <p>Configuración de la partida</p>
          </div>
        </div>
      </header>
      <main className="setup-main">
        <section className="setup-welcome">
          <span className="eyebrow">PANEL DEL DOCENTE</span>
          <h1>Crear una nueva partida</h1>
          <p>Elige qué colores juegan, cuántos alumnos hay en cada uno y cuánto dura todo.</p>

          <label className="field-label">Nombre de la partida</label>
          <input className="game-name" value={gameName} onChange={(e) => setGameName(e.target.value)} />

          <div className="setup-summary three">
            <div>
              <span>Colores jugando</span>
              <strong>{activos.length}</strong>
            </div>
            <div>
              <span>Total de alumnos</span>
              <strong>{totalStudents}</strong>
            </div>
            <div>
              <span>Duración</span>
              <strong>{minutes} min</strong>
            </div>
          </div>

          <h2 className="setup-section-title">¿Qué colores juegan?</h2>
          <p className="muted">Pon “No juega” en los colores que no vas a usar. Hacen falta al menos 2.</p>
          <div className="setup-teams">
            {TURN_ORDER.map((t) => (
              <label className={`team-setting large ${counts[t] === 0 ? "off" : ""}`} key={t}>
                <span>
                  <i className="dot" style={{ background: counts[t] > 0 ? COLORS[t].hex : "#cbd5e1" }} />
                  {COLORS[t].name}
                </span>
                <select value={counts[t]} onChange={(e) => setCounts({ ...counts, [t]: Number(e.target.value) })}>
                  <option value={0}>— No juega —</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} alumno{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <h2 className="setup-section-title">Control del tiempo</h2>
          <div className="time-settings">
            <label>
              <span>Duración de la partida</span>
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[5, 10, 15, 20, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Segundos para responder</span>
              <select value={answerSeconds} onChange={(e) => setAnswerSeconds(Number(e.target.value))}>
                {[10, 15, 20, 30, 45, 60, 90].map((sg) => (
                  <option key={sg} value={sg}>
                    {sg} segundos
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Segundos para lanzar el dado</span>
              <select value={rollSeconds} onChange={(e) => setRollSeconds(Number(e.target.value))}>
                {[5, 10, 15, 20, 30].map((sg) => (
                  <option key={sg} value={sg}>
                    {sg} segundos
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            Podrás pausar, sumar o restar tiempo durante la partida. Si nadie lanza o responde a tiempo, el juego
            continúa solo.
          </p>

          {activos.length < 2 && <p className="join-error">Selecciona al menos 2 colores para poder jugar.</p>}
          {setupError && <p className="join-error">{setupError}</p>}
          <button className="create-ref" disabled={!puedeCrear || creating} onClick={createGame}>
            {creating ? "Creando…" : "Crear partida"}
          </button>
        </section>
        <aside className="setup-preview">
          <span className="preview-badge">CÓMO FUNCIONA</span>
          <h2>Así funcionará</h2>
          <Step n="1" t="Elegir colores y tiempos" d="Solo juegan los colores que actives." />
          <Step n="2" t="Compartir código" d="Los estudiantes ingresan desde sus propios celulares." />
          <Step n="3" t="El alumno lanza el dado" d="Desde su celular, en su turno. Todos ven la animación." />
          <Step n="4" t="Acierta y avanza" d="La ficha avanza el número del dado en el tablero." />
          <Step n="5" t="Todo automático" d="El turno cambia solo; tú solo controlas el reloj." />
        </aside>
      </main>
    </div>
  );
}
const Step = ({ n, t, d }) => (
  <div className="preview-step">
    <b>{n}</b>
    <div>
      <strong>{t}</strong>
      <p>{d}</p>
    </div>
  </div>
);

function LobbyScreen({ gameName, gameCode, teams, activeTeams = TURN_ORDER, connectedByTeam, startGame, newGame, changeDevice }) {
  if (!activeTeams.length) activeTeams = TURN_ORDER;
  return (
    <div className="app reference-theme">
      <header className="ref-topbar">
        <div className="ref-brand">
          <span className="brand-icon">🎲</span>
          <div>
            <h1>Ludo Educativo: Inventos Históricos de la Ingeniería</h1>
            <p>Sala de espera • {gameName}</p>
          </div>
        </div>
        <div className="ref-controls">
          <div className="time-box">
            <span>CÓDIGO</span>
            <b>{gameCode}</b>
          </div>
          <button className="ref-yellow" onClick={changeDevice}>
            Cambiar rol
          </button>
        </div>
      </header>
      <main className="lobby-ref">
        <section className="lobby-main card">
          <span className="eyebrow">SALA DE ESPERA</span>
          <h1>{gameName}</h1>
          <p>Comparte este código con los estudiantes y espera a que se conecten desde sus celulares.</p>
          <div className="join-code-box">
            <span>CÓDIGO DE PARTIDA</span>
            <strong>{gameCode}</strong>
            <small>Proyéctalo en el aula o compártelo por chat.</small>
          </div>
          <div className="connection-grid">
            {activeTeams.map((t) => (
              <div className="connection-card" key={t}>
                <div className="connection-team">
                  <span className="dot" style={{ background: COLORS[t].hex }} />
                  <b>{COLORS[t].name}</b>
                </div>
                <strong>
                  {connectedByTeam[t] || 0} / {teams[t].slots}
                </strong>
                <small>alumnos conectados</small>
              </div>
            ))}
          </div>
          <div className="lobby-actions">
            <button className="create-ref" onClick={startGame}>
              Iniciar partida
            </button>
            <button className="ref-secondary" onClick={newGame}>
              ➕ Crear partida nueva
            </button>
          </div>
        </section>
        <aside className="lobby-side card">
          <span className="eyebrow">VISTA PREVIA DEL CELULAR</span>
          <div className="phone-preview">
            <div className="phone-screen">
              <div className="phone-brand">🎲 Ludo Educativo</div>
              <div className="phone-code-label">Código</div>
              <div className="phone-code">{gameCode}</div>
              <div className="phone-mini-field">Nombre del alumno</div>
              <div className="phone-mini-field">Elegir equipo</div>
              <div className="phone-mini-button">UNIRME A LA PARTIDA</div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function EngineerGame({ tab, setTab, serverState, timerSeconds, phaseSeconds, toggleTimer, addTime, resetTimer, skipTurn, endGame, resetGame, newGame, positions, bank, changeDevice }) {
  const currentTeam = serverState.currentTeam;
  const min = Math.floor((timerSeconds ?? 0) / 60).toString().padStart(2, "0");
  const sec = ((timerSeconds ?? 0) % 60).toString().padStart(2, "0");

  return (
    <div className="app reference-theme">
      <header className="ref-topbar">
        <div className="ref-brand">
          <span className="brand-icon">🎲</span>
          <div>
            <h1>Ludo Educativo: Inventos Históricos de la Ingeniería</h1>
            <p>{serverState.name} • Partida {serverState.code}</p>
          </div>
        </div>
        <div className="ref-controls">
          {/* ---- CONTROL DEL TIEMPO DE LA PARTIDA (solo el docente) ---- */}
          <div className={`time-box ${timerSeconds !== null && timerSeconds <= 60 ? "time-low" : ""}`}>
            <span>TIEMPO</span>
            <b>{min}:{sec}</b>
          </div>
          <div className="time-controls">
            <button title="Quitar 1 minuto" onClick={() => addTime(-60)}>−1m</button>
            <button title="Agregar 1 minuto" onClick={() => addTime(60)}>+1m</button>
            <button title="Agregar 5 minutos" onClick={() => addTime(300)}>+5m</button>
            <button title="Reiniciar el reloj" onClick={resetTimer}>↺</button>
          </div>
          <button className="ref-yellow" onClick={toggleTimer}>
            {serverState.timerRunning ? "⏸ Pausar" : "▶ Iniciar"}
          </button>
          <button className="ref-green" onClick={resetGame}>
            🔄 Reiniciar
          </button>
          <button className="ref-yellow" onClick={newGame}>
            ➕ Partida nueva
          </button>
          <button className="ref-danger" onClick={endGame}>
            Finalizar
          </button>
        </div>
      </header>
      <nav className="ref-nav">
        {[
          ["game", "🎮", "Tablero e Interacción"],
          ["questions", "📚", `Banco de Preguntas (${bank.length || 20})`],
          ["scores", "📊", "Evaluación y Puntajes"],
          ["rules", "📋", "Guía y Reglas"],
        ].map(([id, ic, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {ic}
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {tab === "game" && (
        <GameTab
          gameName={serverState.name}
          currentTeam={currentTeam}
          dice={serverState.lastDice}
          turnPhase={serverState.turnPhase}
          phaseSeconds={phaseSeconds}
          rolledBy={serverState.rolledBy}
          question={serverState.currentQuestion}
          lastResult={serverState.lastResult}
          positions={positions}
          players={serverState.players}
          teams={serverState.teams}
          activeTeams={serverState.activeTeams}
          skipTurn={skipTurn}
        />
      )}
      {tab === "questions" && <QuestionsTab bank={bank} />}
      {tab === "scores" && <ScoresTab teams={serverState.teams} history={serverState.history} />}
      {tab === "rules" && <RulesTab />}
    </div>
  );
}

// ==================== EL DADO (con animación) ====================
// Cada cara se dibuja con puntos en una cuadrícula de 3x3.
// PIPS dice qué posiciones (0 a 8) llevan punto en cada cara.
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Dice({ value, rolling, size = "big" }) {
  const [face, setFace] = useState(value || 1);

  // Mientras "rolling" es true cambiamos de cara cada 90ms: eso es la animación.
  useEffect(() => {
    if (!rolling) {
      if (value) setFace(value);
      return;
    }
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(id);
  }, [rolling, value]);

  const shown = rolling ? face : value;
  return (
    <div className={`dice ${size} ${rolling ? "dice-rolling" : ""}`}>
      {shown ? (
        <div className="dice-face">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={PIPS[shown].includes(i) ? "pip on" : "pip"} />
          ))}
        </div>
      ) : (
        <span className="dice-empty">?</span>
      )}
    </div>
  );
}

// Texto que explica en qué momento del turno estamos (lo ven docente y alumnos)
function phaseMessage({ turnPhase, currentTeam, phaseSeconds, dice, rolledBy, lastResult }) {
  const equipo = COLORS[currentTeam].name;
  switch (turnPhase) {
    case "roll":
      return `Esperando que el equipo ${equipo} lance el dado… (${phaseSeconds ?? 0}s)`;
    case "rolling":
      return "Lanzando el dado…";
    case "question":
      return `Respondiendo la pregunta… quedan ${phaseSeconds ?? 0}s`;
    case "result":
      return lastResult?.isCorrect
        ? describeMove(lastResult)
        : lastResult?.timedOut
        ? "Se acabó el tiempo, nadie respondió. La ficha no se mueve."
        : "Respuesta incorrecta. La ficha se queda donde está.";
    default:
      return "";
  }
}

function GameTab({
  gameName,
  currentTeam,
  dice,
  turnPhase,
  phaseSeconds,
  rolledBy,
  question,
  lastResult,
  positions,
  players,
  teams,
  activeTeams,
  skipTurn,
}) {
  const showQuestion = turnPhase === "question" || turnPhase === "result";
  return (
    <main className="ref-main">
      <section className="ref-board-panel">
        <div className="ref-title-row">
          <div>
            <span className="eyebrow">TABLERO DINÁMICO CLÁSICO</span>
            <h2>{gameName}</h2>
          </div>
          <span className="turn-chip" style={{ background: COLORS[currentTeam].soft, color: COLORS[currentTeam].hex }}>
            Turno: {COLORS[currentTeam].name}
          </span>
        </div>
        <LudoBoard players={players} positions={positions} activeTeams={activeTeams} />
        <div className="legend">
          {activeTeams.map((t) => (
            <span key={t}>
              <i className="dot" style={{ background: COLORS[t].hex }} />
              {COLORS[t].name}
            </span>
          ))}
        </div>
      </section>
      <aside className="ref-side">
        <div className="ref-card">
          <div className="card-head">
            <span className="eyebrow">TURNO ACTUAL · AUTOMÁTICO</span>
            <span className="mini-team" style={{ color: COLORS[currentTeam].hex }}>
              {COLORS[currentTeam].name}
            </span>
          </div>
          <div className="dice-control">
            <Dice value={dice} rolling={turnPhase === "rolling"} />
            <div className="turn-info">
              <div className="phase-bar">
                <div
                  className={`phase-fill phase-${turnPhase}`}
                  style={{ width: `${Math.min(100, ((phaseSeconds ?? 0) / 20) * 100)}%` }}
                />
              </div>
              <p className="status">
                {phaseMessage({ turnPhase, currentTeam, phaseSeconds, dice, rolledBy, lastResult })}
              </p>
              {turnPhase !== "roll" && rolledBy && <small className="muted">Lanzó: {rolledBy}</small>}
              {turnPhase !== "roll" && !rolledBy && dice && <small className="muted">Lo lanzó el sistema (nadie llegó a tiempo)</small>}
            </div>
          </div>
          <p className="projection-note">
            La partida avanza sola: el alumno lanza el dado desde su celular y el turno cambia automáticamente.
          </p>
          <button className="ref-secondary small full" onClick={skipTurn}>
            ⏭ Saltar turno (solo si algo se traba)
          </button>
        </div>
        <div className="ref-card">
          <div className="question-top">
            <span className="eyebrow">PREGUNTA ACTIVA</span>
          </div>
          {showQuestion && question ? (
            <>
              <h3>{question.question}</h3>
              <div className="answer-options">
                {question.options.map((o, i) => {
                  let cls = "";
                  if (lastResult) {
                    if (i === lastResult.correctIndex) cls = "ok";
                    else if (i === lastResult.selectedIndex) cls = "bad";
                  }
                  return (
                    <button key={o} disabled className={cls}>
                      <b>{String.fromCharCode(65 + i)}</b>
                      {o}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-question">La pregunta aparecerá apenas el equipo lance el dado.</div>
          )}
        </div>
        <div className="ref-card">
          <div className="question-top">
            <span className="eyebrow">PROGRESO</span>
            <b>{players.length} alumnos</b>
          </div>
          <div className="team-mini-grid">
            {activeTeams.map((t) => (
              <div key={t}>
                <span style={{ color: COLORS[t].hex }}>{COLORS[t].name}</span>
                <b>{teams[t].score} pts</b>
                <small>{teams[t].slots} cupo{teams[t].slots > 1 ? "s" : ""}</small>
              </div>
            ))}
          </div>
          <div className="piece-list">
            {players.length === 0 && <small className="muted">Nadie se ha conectado todavía.</small>}
            {players.map((p) => {
              const step = positions[p.id] ?? -1;
              return (
                <div className="piece-row" key={p.id}>
                  <span className="board-piece" style={{ background: COLORS[p.team].hex }}>
                    {p.name.trim()[0]?.toUpperCase()}
                  </span>
                  <b>{p.name}</b>
                  <small>{describeStep(step)}</small>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </main>
  );
}

// Traduce un número de paso (0 a 56) a algo legible para el docente
function describeStep(step) {
  if (step < 0) return "en casa";
  if (step >= GOAL_STEP) return "🏆 ¡en la META!";
  if (step >= 51) return `recta final (${step - 50} de 6)`;
  return `casilla ${step + 1} de 57`;
}

// Arma la frase del movimiento que acaba de ocurrir
function describeMove(lastResult) {
  const m = lastResult?.move;
  if (!m) return "¡Respuesta correcta!";
  if (!m.moved) return "¡Correcta! Pero el número se pasa de la meta: hace falta el número exacto.";
  let txt = `¡Correcta! ${lastResult.playerName} avanzó a la ${describeStep(m.to)}.`;
  if (m.captured.length) txt += ` Se comió la ficha de ${m.captured.join(", ")}.`;
  if (m.reachedGoal) txt += " 🏆 ¡LLEGÓ A LA META!";
  return txt;
}

// ==================== EL TABLERO DE LUDO REAL ====================
// Se dibuja como una cuadrícula CSS de 15 columnas x 15 filas.
// Cada casilla se coloca en su sitio con gridRow / gridColumn (1-indexado,
// por eso siempre sumamos +1 a las coordenadas de board.js, que van de 0 a 14).

// Índice del anillo -> color, si esa casilla es la salida de algún equipo
const START_CELL_COLOR = {};
TURN_ORDER.forEach((t) => {
  START_CELL_COLOR[START_INDEX[t]] = t;
});

function LudoBoard({ players, positions = {}, activeTeams = TURN_ORDER, small }) {
  // Red de seguridad extra: si llega un array vacío (no undefined), también caemos a TURN_ORDER.
  if (!activeTeams.length) activeTeams = TURN_ORDER;
  // Agrupamos las fichas por casilla: "fila,columna" -> [jugadores]
  const piecesByCell = useMemo(() => {
    const m = {};
    players.forEach((p) => {
      const step = positions[p.id] ?? -1;
      if (step < 0) return; // sigue en casa, se dibuja en su cuadrado
      const cell = cellForStep(p.team, step);
      if (cell) (m[cellKey(cell)] ??= []).push(p);
    });
    return m;
  }, [players, positions]);

  const piecesAt = (cell) => piecesByCell[cellKey(cell)] || [];

  return (
    <div className={`ludo-board ${small ? "small" : ""}`}>
      {/* --- Las 4 casas (cuadrados de 6x6 en las esquinas) --- */}
      <BaseBox color="rojo" row={1} col={1} players={players} positions={positions} activeTeams={activeTeams} />
      <BaseBox color="verde" row={1} col={10} players={players} positions={positions} activeTeams={activeTeams} />
      <BaseBox color="azul" row={10} col={1} players={players} positions={positions} activeTeams={activeTeams} />
      <BaseBox color="amarillo" row={10} col={10} players={players} positions={positions} activeTeams={activeTeams} />

      {/* --- Las 52 casillas del anillo exterior --- */}
      {RING.map(([r, c], i) => {
        const startColor = START_CELL_COLOR[i];
        const isSafe = SAFE_INDEXES.includes(i);
        const here = piecesAt([r, c]);
        return (
          <div
            key={`ring-${i}`}
            className={`cell ring ${isSafe ? "safe" : ""}`}
            style={{
              gridRow: r + 1,
              gridColumn: c + 1,
              background: startColor ? COLORS[startColor].soft : "#fff",
              borderColor: startColor ? COLORS[startColor].hex : "#cbd5e1",
            }}
          >
            {isSafe && here.length === 0 && <span className="star">★</span>}
            <Tokens list={here} />
          </div>
        );
      })}

      {/* --- Las 4 rectas finales de 5 casillas --- */}
      {TURN_ORDER.map((color) =>
        HOME_COLUMNS[color].map(([r, c], i) => (
          <div
            key={`home-${color}-${i}`}
            className="cell home-lane"
            style={{ gridRow: r + 1, gridColumn: c + 1, background: COLORS[color].hex }}
          >
            <Tokens list={piecesAt([r, c])} />
          </div>
        ))
      )}

      {/* --- El centro: la META --- */}
      <div className="center-goal" style={{ gridRow: "7 / 10", gridColumn: "7 / 10" }}>
        <i className="tri tri-left" style={{ background: COLORS.rojo.hex }} />
        <i className="tri tri-top" style={{ background: COLORS.verde.hex }} />
        <i className="tri tri-right" style={{ background: COLORS.amarillo.hex }} />
        <i className="tri tri-bottom" style={{ background: COLORS.azul.hex }} />
        <div className="goal-inner">
          <span className="goal-cup">🏆</span>
          <Tokens list={piecesAt([7, 7])} />
        </div>
      </div>
    </div>
  );
}

// Fichas dibujadas dentro de una casilla (pueden ser varias apiladas)
function Tokens({ list }) {
  if (!list.length) return null;
  return (
    <div className="tokens">
      {list.map((p) => (
        <span
          key={p.id}
          className="board-piece"
          title={`${p.name} (${COLORS[p.team].name})`}
          style={{ background: COLORS[p.team].hex }}
        >
          {p.name.trim()[0]?.toUpperCase() || "?"}
        </span>
      ))}
    </div>
  );
}

// La casa de un color: 4 huecos donde esperan las fichas que aún no salieron
function BaseBox({ color, row, col, players, positions, activeTeams = TURN_ORDER }) {
  if (!activeTeams.length) activeTeams = TURN_ORDER;
  const mine = players.filter((p) => p.team === color);
  const atHome = mine.filter((p) => (positions[p.id] ?? -1) < 0);
  const juega = activeTeams.includes(color);
  return (
    <div
      className={`base-box ${juega ? "" : "base-off"}`}
      style={{
        gridRow: `${row} / span 6`,
        gridColumn: `${col} / span 6`,
        background: COLORS[color].soft,
        borderColor: COLORS[color].hex,
      }}
    >
      <div className="base-inner">
        {[0, 1, 2, 3].map((i) => (
          <div className="base-slot" key={i} style={{ borderColor: COLORS[color].hex }}>
            {atHome[i] && (
              <span className="board-piece" title={atHome[i].name} style={{ background: COLORS[color].hex }}>
                {atHome[i].name.trim()[0]?.toUpperCase() || "?"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionsTab({ bank }) {
  return (
    <main className="ref-content">
      <div className="ref-card wide">
        <h2>Banco de Preguntas: Inventos Históricos de la Ingeniería</h2>
        <p className="muted">Preguntas almacenadas en la base de datos del servidor (opción múltiple).</p>
        <div className="question-table">
          {bank.map((q) => (
            <div className="q-row" key={q.id}>
              <b>{q.id}</b>
              <span>
                <strong>{q.topic}</strong>
                <small>{q.level}</small>
              </span>
              <p>{q.question}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function ScoresTab({ teams, history }) {
  return (
    <main className="ref-content">
      <div className="score-grid">
        {TURN_ORDER.map((t) => (
          <div className="score-card" key={t} style={{ borderTopColor: COLORS[t].hex }}>
            <span>{COLORS[t].name}</span>
            <strong>{teams[t].score} / 20</strong>
            <small>
              {teams[t].correct} correctas • {teams[t].incorrect} incorrectas
            </small>
          </div>
        ))}
      </div>
      <div className="ref-card wide">
        <h2>Historial de turnos</h2>
        {history.length === 0 ? (
          <p className="muted">Aún no hay registros.</p>
        ) : (
          history.map((h) => (
            <div className="history-row" key={`${h.turn}-${h.team}`}>
              <span>Turno {h.turn}</span>
              <b style={{ color: COLORS[h.team].hex }}>{COLORS[h.team].name}</b>
              <span>🎲 {h.dice}</span>
              <span>{h.topic}</span>
              <b>{h.correct ? "✓ Correcta" : "✕ Incorrecta"}</b>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

function RulesTab() {
  return (
    <main className="ref-content">
      <div className="rules-grid">
        <div className="ref-card">
          <h2>Flujo propuesto</h2>
          <ol>
            <li>Crear y configurar la partida.</li>
            <li>Compartir el código con los alumnos.</li>
            <li>Lanzar el dado en el proyector.</li>
            <li>Mostrar la pregunta.</li>
            <li>El equipo en turno responde desde sus celulares.</li>
            <li>Aplicar el movimiento y continuar.</li>
          </ol>
        </div>
        <div className="ref-card">
          <h2>Reglas del tablero</h2>
          <p><b>Acierta → avanza.</b> La ficha avanza exactamente el número que marcó el dado.</p>
          <p><b>Falla o se le acaba el tiempo → no se mueve.</b></p>
          <p>Cada ficha recorre 57 pasos: 51 casillas del anillo + 5 de su recta final + la meta.</p>
          <p>Con la primera respuesta correcta la ficha sale de casa a su casilla de salida.</p>
          <p>Para entrar a la meta hace falta el número exacto; si se pasa, se queda donde está.</p>
          <p>Si cae justo sobre una ficha rival la come y esa ficha vuelve a casa, salvo en las casillas seguras (★).</p>
          <p>Gana el primer equipo que lleve una ficha a la meta; si se acaba el tiempo, gana el de más puntos.</p>
        </div>
      </div>
    </main>
  );
}

// ==================== Pantallas del estudiante ====================

function StudentJoin({ joinCode, setJoinCode, studentName, setStudentName, studentTeam, setStudentTeam, submitJoin, joinError, gameInfo }) {
  // Colores que juegan en ESA partida, con su cupo disponible
  const opciones = (gameInfo?.activeTeams || TURN_ORDER).map((t) => {
    const ocupados = gameInfo ? gameInfo.players.filter((p) => p.team === t).length : 0;
    const cupo = gameInfo ? gameInfo.teams[t].slots : 4;
    return { team: t, ocupados, cupo, lleno: gameInfo ? ocupados >= cupo : false };
  });
  const hayCupo = opciones.some((o) => !o.lleno);

  return (
    <div className="app student-lobby">
      <header className="ref-topbar">
        <div className="ref-brand">
          <span className="brand-icon">🎲</span>
          <div>
            <h1>Ludo Educativo</h1>
            <p>Ingreso del alumno</p>
          </div>
        </div>
      </header>
      <main className="student-page">
        <div className="phone-card join-card">
          <span className="eyebrow">LUDO EDUCATIVO</span>
          <h1>Unirse a la partida</h1>
          <p className="muted">Ingresa el código que el docente proyectó en clase.</p>
          <label className="field-label">Código de partida</label>
          <input
            className="game-name student-code-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Ej. 583421"
            maxLength={6}
          />
          <label className="field-label">Tu nombre</label>
          <input className="game-name" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Ej. Andrea" />
          <label className="field-label team-label">Tu equipo</label>
          {gameInfo ? (
            <>
              <p className="muted found-game">✓ Partida encontrada: <b>{gameInfo.name}</b></p>
              <div className="team-picker">
                {opciones.map((o) => (
                  <button
                    key={o.team}
                    type="button"
                    disabled={o.lleno}
                    className={`team-option ${studentTeam === o.team ? "picked" : ""}`}
                    style={{ borderColor: studentTeam === o.team ? COLORS[o.team].hex : "#e2e8f0" }}
                    onClick={() => setStudentTeam(o.team)}
                  >
                    <i className="dot" style={{ background: COLORS[o.team].hex }} />
                    <b>{COLORS[o.team].name}</b>
                    <small>{o.lleno ? "Lleno" : `${o.ocupados}/${o.cupo}`}</small>
                  </button>
                ))}
              </div>
              {!hayCupo && <p className="join-error">Todos los equipos están llenos.</p>}
            </>
          ) : (
            <p className="muted">Escribe el código completo para ver los equipos disponibles.</p>
          )}
          {joinError && <p className="join-error">{joinError}</p>}
          <button
            className="create-ref"
            disabled={!studentName.trim() || joinCode.trim().length !== 6 || !gameInfo || !hayCupo}
            onClick={submitJoin}
          >
            Unirme a la partida
          </button>
        </div>
      </main>
    </div>
  );
}

function StudentWaiting({ gameCode, studentName, studentTeam, changeDevice }) {
  return (
    <div className="app student-lobby">
      <header className="ref-topbar">
        <div className="ref-brand">
          <span className="brand-icon">🎲</span>
          <div>
            <h1>Ludo Educativo</h1>
            <p>Ingreso del alumno</p>
          </div>
        </div>
      </header>
      <main className="student-page">
        <div className="phone-card">
          <span className="eyebrow">LUDO EDUCATIVO</span>
          <div className="join-success">✓</div>
          <h1>¡Ya estás dentro!</h1>
          <p className="muted">
            Partida <b>{gameCode}</b>
          </p>
          <div className="joined-summary">
            <strong>{studentName || "Alumno"}</strong>
            <span style={{ color: COLORS[studentTeam].hex }}>Equipo {COLORS[studentTeam].name}</span>
          </div>
          <div className="waiting">
            <div className="phone-icon">🎲</div>
            <h2>Espera al docente</h2>
            <p>Cuando el docente inicie la partida, la pregunta aparecerá aquí en tu turno.</p>
          </div>
          <button className="ref-secondary" onClick={changeDevice}>
            Salir
          </button>
        </div>
      </main>
    </div>
  );
}

function StudentGame({ serverState, playerId, selected, phaseSeconds, positions, submitAnswer, rollDice, changeDevice }) {
  const me = serverState.players.find((p) => p.id === playerId);
  const myTeam = me?.team;
  const isMyTurn = serverState.currentTeam === myTeam;
  const { turnPhase, currentQuestion: question, lastResult, lastDice, rolledBy } = serverState;

  const canAnswer = isMyTurn && turnPhase === "question" && selected === null;
  const revealed = turnPhase === "result" && !!lastResult;
  const rivalName = COLORS[serverState.currentTeam].name;

  return (
    <div className="app student-lobby">
      <header className="ref-topbar">
        <div className="ref-brand">
          <span className="brand-icon">🎲</span>
          <div>
            <h1>Ludo Educativo</h1>
            <p>Participación del alumno</p>
          </div>
        </div>
        <div className="time-box">
          <span>PARTIDA</span>
          <b>{serverState.code}</b>
        </div>
      </header>
      <main className="student-page">
        <div className="phone-card">
          <span className="eyebrow" style={{ color: COLORS[myTeam]?.hex }}>
            EQUIPO {COLORS[myTeam]?.name.toUpperCase()} · {me?.name}
          </span>

          <div className="mobile-board-wrap">
            <LudoBoard players={serverState.players} positions={positions} activeTeams={serverState.activeTeams} small />
          </div>

          {/* ---------- FASE 1: LANZAR EL DADO ---------- */}
          {turnPhase === "roll" && (
            <div className="roll-zone">
              <Dice value={null} rolling={false} />
              {isMyTurn ? (
                <>
                  <h2>¡Es tu turno!</h2>
                  <button className="roll-btn" onClick={rollDice}>
                    🎲 LANZAR DADO
                  </button>
                  <p className="muted">
                    Si nadie lanza en <b>{phaseSeconds ?? 0}s</b>, el sistema lo lanza por ustedes.
                  </p>
                </>
              ) : (
                <>
                  <h2>Turno del equipo {rivalName}</h2>
                  <p className="muted">Están lanzando el dado… ({phaseSeconds ?? 0}s)</p>
                </>
              )}
            </div>
          )}

          {/* ---------- FASE 2: EL DADO GIRANDO ---------- */}
          {turnPhase === "rolling" && (
            <div className="roll-zone">
              <Dice value={lastDice} rolling />
              <h2>Lanzando…</h2>
              <p className="muted">{rolledBy ? `Lanzó ${rolledBy}` : "Lo lanzó el sistema"}</p>
            </div>
          )}

          {/* ---------- FASES 3 y 4: PREGUNTA Y RESULTADO ---------- */}
          {(turnPhase === "question" || turnPhase === "result") && question && (
            <>
              <div className="dice-result-row">
                <Dice value={lastDice} rolling={false} size="mini" />
                <div>
                  <strong>Salió {lastDice}</strong>
                  <small className="muted">
                    {isMyTurn ? `Acierten y avanzan ${lastDice} casilla${lastDice > 1 ? "s" : ""}` : `Turno de ${rivalName}`}
                  </small>
                </div>
              </div>

              {turnPhase === "question" && (
                <div className={`answer-timer ${(phaseSeconds ?? 0) <= 5 ? "answer-timer-urgent" : ""}`}>
                  ⏱️ <b>{phaseSeconds ?? 0}s</b> para responder
                </div>
              )}

              <h2 className="mobile-question">{question.question}</h2>
              <div className="mobile-options">
                {question.options.map((o, i) => {
                  let cls = "";
                  if (revealed) {
                    if (i === lastResult.correctIndex) cls = "mobile-correct";
                    else if (i === lastResult.selectedIndex) cls = "mobile-wrong";
                  } else if (selected === i) {
                    cls = "mobile-selected";
                  }
                  return (
                    <button key={o} disabled={!canAnswer} className={cls} onClick={() => submitAnswer(i)}>
                      <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                      <span className="opt-text">{o}</span>
                    </button>
                  );
                })}
              </div>

              {turnPhase === "question" && selected !== null && (
                <div className="answer-result">Respuesta enviada, esperando el resultado…</div>
              )}

              {revealed && (
                <>
                  <div className={`answer-result ${lastResult.isCorrect ? "result-ok" : "result-bad"}`}>
                    {isMyTurn
                      ? lastResult.isCorrect
                        ? describeMove(lastResult)
                        : lastResult.timedOut
                        ? `Se acabó el tiempo. La respuesta correcta era: ${lastResult.correctText}`
                        : `Incorrecto. La respuesta correcta era: ${lastResult.correctText}`
                      : `El equipo ${COLORS[lastResult.team].name} respondió ${
                          lastResult.isCorrect ? "correctamente" : "de forma incorrecta"
                        }.`}
                  </div>
                  <p className="muted">Siguiente turno en {phaseSeconds ?? 0}s…</p>
                </>
              )}
            </>
          )}

          <button className="ref-secondary" onClick={changeDevice}>
            Salir
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
