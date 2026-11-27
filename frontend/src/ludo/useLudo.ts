import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { socket } from "../socket";
import { useSalaEnVivo } from "../salaEnVivo";
import { cronometro } from "../cronometroStore";
import type { Equipo } from "../constants";
import type { PublicUser } from "../../../shared/types/api";

/** Lo que el alumno ve de una partida antes de unirse (GET /api/games/:code). */
interface InfoPartida {
  activeTeams: Equipo[];
  players: { team: Equipo }[];
  teams: Record<Equipo, { slots: number }>;
  [dato: string]: unknown;
}
/** Estado de la partida que manda el servidor (evento "state"). Las pantallas leen el resto. */
type EstadoLudo = {
  players: { team: Equipo }[];
  turnPhase?: string;
  timerSeconds?: number | null;
  phaseSecondsLeft?: number | null;
} & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Modo = "student" | "engineer" | null;
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "");

// ============================================================================
// LUDO: todo el estado de una partida (docente o estudiante), la conexión por
// socket y las acciones. App.jsx solo decide CUÁNDO se ve Ludo (la ruta);
// las pantallas están en LudoPantallas.jsx.
// ============================================================================

// localStorage puede estar bloqueado (modo privado, políticas del colegio): sin try, la app se caía.
function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function useLudo({ user }: { user: PublicUser | null }) {
  const [mode, setMode] = useState<Modo>(() => (leerLocal("ludo_mode") as Modo) || null);
  const [tab, setTab] = useState("game");
  const [selected, setSelected] = useState<number | null>(null);
  const [bank, setBank] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    cronometro.ajustar({ oculto: !!mode }); // con una partida de Ludo en pantalla, la ventanita se esconde
  }, [mode]);

  // --- Ingeniero: configuración inicial ---
  const [gameName, setGameName] = useState("Historia de la Ingeniería");
  const [counts, setCounts] = useState<Record<Equipo, number>>({ rojo: 1, verde: 1, amarillo: 1, azul: 0 }); // 0 = ese color no juega
  const [minutes, setMinutes] = useState(30); // duración de la partida
  const [answerSeconds, setAnswerSeconds] = useState(20); // segundos para responder
  const [rollSeconds, setRollSeconds] = useState(15); // segundos para lanzar el dado
  const [setupError, setSetupError] = useState("");
  const [engineerGameCode, setEngineerGameCode] = useState(() => leerLocal("ludo_engineer_code") || "");

  // --- Estudiante: ingreso ---
  const [joinCode, setJoinCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentTeam, setStudentTeam] = useState<Equipo>("rojo");
  const [playerId, setPlayerId] = useState<string | null>(() => leerLocal("ludo_player_id") || null);
  // Llave privada que da el servidor al unirse: sin ella no se puede tirar el dado ni responder.
  const [playerKey, setPlayerKey] = useState<string | null>(() => leerLocal("ludo_player_key") || null);
  const [studentGameCode, setStudentGameCode] = useState(() => leerLocal("ludo_game_code") || "");
  const [joinError, setJoinError] = useState("");
  const [gameInfo, setGameInfo] = useState<InfoPartida | null>(null); // datos de la partida antes de unirse
  const [connError, setConnError] = useState(""); // "la partida ya no existe", etc.

  const gameCode = mode === "student" ? studentGameCode : engineerGameCode;

  // --- Estado compartido recibido del servidor ---
  const [serverState, setServerState] = useState<EstadoLudo | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [phaseSeconds, setPhaseSeconds] = useState<number | null>(null);

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

  // Estado de la partida que manda el servidor. Al reconectarse el socket (celular bloqueado,
  // cambio de red...) se vuelve a entrar a la sala: el socket nuevo no está en ninguna.
  const entrarASala = () => gameCode && socket.emit("join-room", { code: gameCode });
  useSalaEnVivo({
    eventos: {
      state: (s: EstadoLudo) => {
        setConnError("");
        setServerState(s);
        // Se sincroniza siempre con el servidor (así los +1m/-1m/+5m del docente se ven al instante).
        setTimerSeconds(s.timerSeconds ?? null);
        setPhaseSeconds(s.phaseSecondsLeft ?? null);
        if (s.turnPhase !== "question") setSelected(null);
      },
      timer: (t: number) => setTimerSeconds(t),
      // cuánto le queda a la fase actual del turno
      "phase-timer": ({ seconds }: { seconds: number }) => setPhaseSeconds(seconds),
      // "Partida no encontrada", etc.: sin esto el alumno se quedaba en "Conectando…" para siempre
      "error-message": (msg: string) => setConnError(msg || "No se pudo conectar con la partida"),
    },
    alReconectar: entrarASala,
  });
  useEffect(() => {
    entrarASala();
  }, [gameCode]); // eslint-disable-line react-hooks/exhaustive-deps

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
      .then((info) => !cancelado && setGameInfo(info as InfoPartida))
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

  function chooseMode(m: "student" | "engineer") {
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
      setSetupError(mensaje(e) || "No se pudo crear la partida. Revisa que el backend esté corriendo.");
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
      setJoinError(mensaje(e));
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
    socket.emit("player:roll-dice", { code: gameCode, playerId: playerId ?? "", playerKey: playerKey ?? "" });
  }
  function endGame() {
    socket.emit("engineer:end-game", { code: gameCode });
  }
  // El docente suma o resta tiempo al reloj de la partida (en segundos)
  function addTime(seconds: number) {
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
  function submitAnswer(index: number) {
    if (selected !== null || !playerId) return;
    setSelected(index);
    socket.emit("team:answer", { code: gameCode, playerId, playerKey: playerKey ?? "", optionIndex: index });
  }

  const connectedByTeam = useMemo(() => {
    const r: Record<Equipo, number> = { rojo: 0, verde: 0, amarillo: 0, azul: 0 };
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
