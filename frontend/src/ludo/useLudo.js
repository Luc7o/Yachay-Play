import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { socket } from "../socket";
import { cronometro } from "../cronometroStore";

// ============================================================================
// LUDO: todo el estado de una partida (docente o estudiante), la conexión por
// socket y las acciones. App.jsx solo decide CUÁNDO se ve Ludo (la ruta);
// las pantallas están en LudoPantallas.jsx.
// ============================================================================

// localStorage puede estar bloqueado (modo privado, políticas del colegio): sin try, la app se caía.
function leerLocal(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function useLudo({ user }) {
  const [mode, setMode] = useState(() => leerLocal("ludo_mode") || null);
  const [tab, setTab] = useState("game");
  const [selected, setSelected] = useState(null);
  const [bank, setBank] = useState([]);
  useEffect(() => {
    cronometro.ajustar({ oculto: !!mode }); // con una partida de Ludo en pantalla, la ventanita se esconde
  }, [mode]);

  // --- Ingeniero: configuración inicial ---
  const [gameName, setGameName] = useState("Historia de la Ingeniería");
  const [counts, setCounts] = useState({ rojo: 1, verde: 1, amarillo: 1, azul: 0 }); // 0 = ese color no juega
  const [minutes, setMinutes] = useState(30); // duración de la partida
  const [answerSeconds, setAnswerSeconds] = useState(20); // segundos para responder
  const [rollSeconds, setRollSeconds] = useState(15); // segundos para lanzar el dado
  const [setupError, setSetupError] = useState("");
  const [engineerGameCode, setEngineerGameCode] = useState(() => leerLocal("ludo_engineer_code") || "");

  // --- Estudiante: ingreso ---
  const [joinCode, setJoinCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentTeam, setStudentTeam] = useState("rojo");
  const [playerId, setPlayerId] = useState(() => leerLocal("ludo_player_id") || null);
  // Llave privada que da el servidor al unirse: sin ella no se puede tirar el dado ni responder.
  const [playerKey, setPlayerKey] = useState(() => leerLocal("ludo_player_key") || null);
  const [studentGameCode, setStudentGameCode] = useState(() => leerLocal("ludo_game_code") || "");
  const [joinError, setJoinError] = useState("");
  const [gameInfo, setGameInfo] = useState(null); // datos de la partida antes de unirse
  const [connError, setConnError] = useState(""); // "la partida ya no existe", etc.

  const gameCode = mode === "student" ? studentGameCode : engineerGameCode;

  // --- Estado compartido recibido del servidor ---
  const [serverState, setServerState] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(null);
  const [phaseSeconds, setPhaseSeconds] = useState(null);

  // Con cuenta de estudiante, el nombre ya viene escrito.
  useEffect(() => {
    if (user && !studentName) setStudentName(user.name);
  }, [user]); // eslint-disable-line

  // Código que llega en el enlace / QR de los estudiantes (?code=123456)
  useEffect(() => {
    const codeParam = new URLSearchParams(window.location.search).get("code");
    if (codeParam) setJoinCode(codeParam);
  }, []);

  // Banco de preguntas visible en el panel del docente (oficiales + las suyas, si hay sesión)
  useEffect(() => {
    api
      .questions()
      .then(setBank)
      .catch(() => {});
  }, [user?.id]);

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
  // y otra vez cada vez que el socket se reconecta (celular bloqueado, cambio de red...):
  // el socket nuevo no está en ninguna sala y la partida se vería congelada.
  useEffect(() => {
    if (!gameCode) return;
    const entrar = () => socket.emit("join-room", { code: gameCode });
    entrar();
    socket.on("connect", entrar);
    return () => socket.off("connect", entrar);
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
      (t) => gameInfo.players.filter((p) => p.team === t).length < gameInfo.teams[t].slots,
    );
    if (libres.length && !libres.includes(studentTeam)) setStudentTeam(libres[0]);
  }, [gameInfo]); // eslint-disable-line

  function chooseMode(m) {
    setMode(m);
    localStorage.setItem("ludo_mode", m);
  }

  // Borra lo que quedó de una partida anterior (no toca la sesión de la cuenta).
  function limpiar() {
    localStorage.removeItem("ludo_mode");
    localStorage.removeItem("ludo_player_id");
    localStorage.removeItem("ludo_player_key");
    localStorage.removeItem("ludo_game_code");
    localStorage.removeItem("ludo_engineer_code");
    setMode(null);
    setServerState(null);
    setPlayerId(null);
    setPlayerKey(null);
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
      const { playerId: pid, playerKey: llave } = await api.joinGame(joinCode.trim(), studentName.trim(), studentTeam);
      setPlayerId(pid);
      setPlayerKey(llave);
      localStorage.setItem("ludo_player_key", llave);
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
    socket.emit("player:roll-dice", { code: gameCode, playerId, playerKey });
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
    if (
      !window.confirm("¿Reiniciar la partida? Se borran fichas, puntajes e historial (los alumnos siguen conectados).")
    )
      return;
    socket.emit("engineer:reset-game", { code: gameCode });
  }
  // ADMIN: cierra esta partida y vuelve a la pantalla de configuración
  // para crear una partida nueva, con código nuevo.
  function newGame() {
    if (
      !window.confirm(
        "¿Crear una partida totalmente nueva? Se generará otro código y los alumnos deberán volver a ingresar.",
      )
    )
      return;
    socket.emit("engineer:end-game", { code: gameCode });
    localStorage.removeItem("ludo_engineer_code");
    setEngineerGameCode("");
    setServerState(null);
    setTimerSeconds(null);
  }
  function submitAnswer(index) {
    if (selected !== null || !playerId) return;
    setSelected(index);
    socket.emit("team:answer", { code: gameCode, playerId, playerKey, optionIndex: index });
  }

  const connectedByTeam = useMemo(() => {
    const r = { rojo: 0, verde: 0, amarillo: 0, azul: 0 };
    if (serverState) serverState.players.forEach((p) => (r[p.team] = (r[p.team] || 0) + 1));
    return r;
  }, [serverState]);

  return {
    addTime,
    answerSeconds,
    bank,
    chooseMode,
    connError,
    connectedByTeam,
    counts,
    createGame,
    creating,
    endGame,
    engineerGameCode,
    gameCode,
    gameInfo,
    gameName,
    joinCode,
    joinError,
    limpiar,
    minutes,
    mode,
    newGame,
    phaseSeconds,
    playerId,
    playerKey,
    playerRollDice,
    resetGame,
    resetTimer,
    rollSeconds,
    selected,
    serverState,
    setAnswerSeconds,
    setBank,
    setConnError,
    setCounts,
    setCreating,
    setEngineerGameCode,
    setGameInfo,
    setGameName,
    setJoinCode,
    setJoinError,
    setMinutes,
    setMode,
    setPhaseSeconds,
    setPlayerId,
    setPlayerKey,
    setRollSeconds,
    setSelected,
    setServerState,
    setSetupError,
    setStudentGameCode,
    setStudentName,
    setStudentTeam,
    setTab,
    setTimerSeconds,
    setupError,
    skipTurn,
    startGame,
    studentGameCode,
    studentName,
    studentTeam,
    submitAnswer,
    submitJoin,
    tab,
    timerSeconds,
    toggleTimer,
  };
}
