import { lazy, useEffect, useMemo, useRef, useState } from "react";
import { api, getToken, setToken } from "./api";
import { socket, reconnectSocket } from "./socket";
import { AuthScreen } from "./AuthScreen";
import { ForgotPasswordScreen, ResetPasswordScreen, TwoFactorStep, VerifyEmailScreen } from "./AuthExtras";
import { GameCatalog } from "./GameCatalog";
import { AppShell } from "./AppShell";
import { InfoPage } from "./InfoPages";
import { cronometro } from "./cronometroStore";
import { EVENTO_ABRIR } from "./CronometroMini";
import { BUILD_VERSION } from "./constants";
import { setClaseDestino, limpiarClaseDestino } from "./claseDestino";
import { Marca } from "./campusUi";
import { ChooserScreen } from "./screens/ChooserScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { FinishedScreen } from "./screens/FinishedScreen";
import { SetupScreen } from "./ludo/SetupScreen";
import { LobbyScreen } from "./ludo/LobbyScreen";
import { EngineerGame } from "./ludo/EngineerGame";
import { StudentJoin, StudentWaiting, StudentGame } from "./ludo/Student";

// Pantallas que se cargan bajo demanda: un alumno que entra a Ludo desde el celular
// ya no descarga la Pizarra, la Ruleta, el Estudio, etc. (el Suspense está en main.jsx).
// Sus CSS se cargan igual al inicio, desde estilos.js, para no cambiar el orden.
const diferido = (cargar, nombre) => lazy(() => cargar().then((m) => ({ default: m[nombre] })));
const CrosswordGame = diferido(() => import("./cw/CrosswordGame"), "CrosswordGame");
const PalabraRelampago = diferido(() => import("./PalabraRelampago"), "PalabraRelampago");
const StatsPage = diferido(() => import("./Stats"), "StatsPage");
const QuestionBankPage = diferido(() => import("./QuestionBank"), "QuestionBankPage");
const ProfilePage = diferido(() => import("./Profile"), "ProfilePage");
const Cronometro = diferido(() => import("./Cronometro"), "Cronometro");
const Ruleta = diferido(() => import("./Ruleta"), "Ruleta");
const Pizarra = diferido(() => import("./Pizarra"), "Pizarra");
const Estudio = diferido(() => import("./estudio/Estudio"), "Estudio");
const Evaluacion = diferido(() => import("./quiz/Evaluacion"), "Evaluacion");
const ClasesPage = diferido(() => import("./clases/Clases"), "ClasesPage");

// localStorage puede estar bloqueado (modo privado, políticas del colegio): sin try, la app se caía.
function leerLocal(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

// Enlace del correo de recuperación: https://www.yachayplay.com/#/restablecer/<token>
function leerTokenRestablecer() {
  const m = window.location.hash.match(/^#\/restablecer\/([A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : null;
}

// Enlace del correo de verificación: https://www.yachayplay.com/#/verificar/<token>
function leerTokenVerificar() {
  const m = window.location.hash.match(/^#\/verificar\/([A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : null;
}

const JUEGOS_RUTA = ["ludo", "crucigrama", "palabra", "evaluacion", "estudio", "cronometro", "ruleta", "pizarra"];
const RUTAS_PANEL = ["inicio", "juegos", "herramientas", "stats", "questions", "profile", "planes", "contacto", "clases"];

function App() {
  const [mode, setMode] = useState(() => leerLocal("ludo_mode") || null);
  const [catalogGame, setCatalogGame] = useState(null); // juego elegido en el catálogo (null = ver catálogo)
  const [seccion, setSeccion] = useState("inicio"); // inicio | juegos | herramientas (menú del docente)
  const [toolPage, setToolPage] = useState(null); // null | "stats" | "questions" | "profile" | "clases" (pantallas del catálogo)
  const [claseAbierta, setClaseAbierta] = useState(null); // id de la clase a mostrar al abrir "Mis clases"
  const [codigoInicial, setCodigoInicial] = useState(""); // código para prellenar al entrar a un juego desde una clase

  // La ventanita del cronómetro (fuera de App) pide abrir su pantalla con este evento.
  // No se ofrece durante una partida de Ludo, para no sacar a nadie de ella sin querer.
  const abrirHerramientaRef = useRef(null);
  abrirHerramientaRef.current = (id) => {
    setToolPage(null);
    selectGame(id);
  };
  useEffect(() => {
    const abrir = (e) => {
      if (e.detail) abrirHerramientaRef.current(e.detail);
    };
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);
  useEffect(() => {
    cronometro.ajustar({ oculto: !!mode }); // con una partida de Ludo en pantalla, la ventanita se esconde
  }, [mode]);

  // --- Cuenta: quién es el usuario y qué rol tiene (se elige una sola vez al registrarse) ---
  const [user, setUser] = useState(null); // { id, name, email, role: "docente" | "estudiante" }
  const [authReady, setAuthReady] = useState(() => !getToken()); // false mientras se valida la sesión guardada
  const [authScreen, setAuthScreen] = useState(null); // null | "login" | "register"
  const [tab, setTab] = useState("game");
  const [selected, setSelected] = useState(null);
  const [bank, setBank] = useState([]);
  const [challenge2fa, setChallenge2fa] = useState(null); // 2.º paso del login (cuenta con 2FA)
  const [olvide, setOlvide] = useState(false); // pantalla "¿Olvidaste tu contraseña?"
  const [resetToken, setResetToken] = useState(leerTokenRestablecer); // viene del enlace del correo
  const [verifyToken, setVerifyToken] = useState(leerTokenVerificar); // enlace de verificación de correo
  useEffect(() => {
    // Sacamos el token de la barra de direcciones (queda solo en memoria).
    if (resetToken || verifyToken) window.history.replaceState(null, "", window.location.pathname + window.location.search + "#/inicio");
  }, []); // eslint-disable-line

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

  // Al abrir la app: si hay una sesión guardada, comprobamos que siga siendo válida.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(({ user: u }) => setUser(u))
      .catch((e) => {
        if (e.status === 401) setToken(null); // sesión vencida: la olvidamos
      })
      .finally(() => setAuthReady(true));
  }, []);

  // Solo un docente con sesión puede estar en el panel del docente.
  useEffect(() => {
    if (!authReady) return;
    if (mode === "engineer" && user?.role !== "docente") changeDevice();
  }, [authReady, user, mode]); // eslint-disable-line

  // Con cuenta de estudiante, el nombre ya viene escrito.
  useEffect(() => {
    if (user && !studentName) setStudentName(user.name);
  }, [user]); // eslint-disable-line

  // Leer parámetros de la URL (para el enlace/QR que reciben los estudiantes)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    const roleParam = params.get("role");
    if (codeParam) setJoinCode(codeParam);
    if (roleParam === "student" && !mode) setMode("student");
  }, []); // eslint-disable-line

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
      (t) => gameInfo.players.filter((p) => p.team === t).length < gameInfo.teams[t].slots
    );
    if (libres.length && !libres.includes(studentTeam)) setStudentTeam(libres[0]);
  }, [gameInfo]); // eslint-disable-line

  function chooseMode(m) {
    setMode(m);
    localStorage.setItem("ludo_mode", m);
  }

  // Borra lo que quedó de una partida anterior (no toca la sesión de la cuenta).
  function clearGameSession() {
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

  // "Salir" / "Volver al inicio": deja la partida y vuelve al catálogo (la cuenta sigue abierta).
  function changeDevice() {
    clearGameSession();
    setCatalogGame(null);
  }

  // Elegir un juego en el catálogo. Con cuenta, el rol ya se conoce: se entra directo.
  function selectGame(id) {
    // Si quedó una partida de Ludo a medias de una sesión anterior (el "mode"
    // se guarda en el navegador y solo se borra al pulsar "Volver al inicio"),
    // hay que limpiarla ANTES de entrar a otro juego; si no, esa partida vieja
    // secuestra la pantalla sin importar qué juego se elija ahora.
    if (id !== "ludo" && mode) clearGameSession();
    setCatalogGame(id);
    // Cada juego nuevo maneja su propio flujo (ver más abajo); solo Ludo usa "mode".
    if (user && id === "ludo") chooseMode(user.role === "docente" ? "engineer" : "student");
  }

  function handleAuthSuccess({ token, user: u }) {
    setToken(token);
    reconnectSocket(); // el servidor debe ver el token nuevo
    clearGameSession();
    setUser(u);
    setAuthScreen(null);
    // Al entrar al panel, limpiar la ruta pública previa sin recargar la aplicación.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setToolPage(null);
    setSeccion("inicio");
    window.dispatchEvent(new Event("yachay-auth-changed")); // para que el Asistente IA (fuera de App) se entere
    if (catalogGame === "ludo") chooseMode(u.role === "docente" ? "engineer" : "student");
  }

  function logout() {
    setToolPage(null);
    setToken(null);
    reconnectSocket();
    setUser(null);
    setStudentName("");
    setAuthScreen(null);
    // El botón de salir siempre regresa a la portada pública.
    window.history.replaceState(null, "", window.location.pathname + window.location.search + "#/inicio");
    window.dispatchEvent(new Event("yachay-auth-changed")); // ídem: que el Asistente IA desaparezca al salir
    changeDevice();
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
    socket.emit("team:answer", { code: gameCode, playerId, playerKey, optionIndex: index });
  }

  const connectedByTeam = useMemo(() => {
    const r = { rojo: 0, verde: 0, amarillo: 0, azul: 0 };
    if (serverState) serverState.players.forEach((p) => (r[p.team] = (r[p.team] || 0) + 1));
    return r;
  }, [serverState]);

  // ---- Historial del navegador (flechas volver / avanzar) dentro del panel ----
  // Cada pantalla del panel tiene su ruta (#/app/...). Al navegar se agrega al
  // historial; al usar las flechas, la ruta de la URL se vuelve a aplicar.
  const rutaPanel = !user
    ? null
    : toolPage
      ? toolPage === "clases" && claseAbierta ? `#/app/clases/${claseAbierta}` : `#/app/${toolPage}`
      : mode
        ? "#/app/ludo"
        : catalogGame
          ? `#/app/juego/${catalogGame}`
          : `#/app/${seccion}`;
  const desdeHistorialRef = useRef(false);
  // Al recargar con una ruta del panel (#/app/clases...), se abre esa pantalla.
  const usuarioId = user?.id;
  useEffect(() => {
    if (!usuarioId || mode || !window.location.hash.startsWith("#/app/")) return;
    const [, r, id] = window.location.hash.match(/^#\/app\/([a-z]+)(?:\/(.+))?$/) || [];
    const valida = r === "ludo" || r === "clases" || (r === "juego" && JUEGOS_RUTA.includes(id)) || (RUTAS_PANEL.includes(r) && !id);
    if (valida) aplicarRutaRef.current?.(true);
  }, [usuarioId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!rutaPanel || verifyToken || resetToken) return;
    if (desdeHistorialRef.current === "cargando") {
      desdeHistorialRef.current = true; // la ruta cargada se aplica en el próximo render
      return;
    }
    const desdeHistorial = desdeHistorialRef.current;
    desdeHistorialRef.current = false;
    if (window.location.hash === rutaPanel) return;
    const url = window.location.pathname + window.location.search + rutaPanel;
    // Primera ruta del panel, o corrección tras usar las flechas: se reemplaza (no se apila).
    if (desdeHistorial || !window.location.hash.startsWith("#/app/")) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }, [rutaPanel, verifyToken, resetToken]);
  const aplicarRutaRef = useRef(null);
  aplicarRutaRef.current = (alCargar = false) => {
    if (!user || window.location.hash === rutaPanel) return;
    // Salir de una partida de Ludo en curso con las flechas: se pide confirmación.
    if (mode && (engineerGameCode || studentGameCode) && !window.confirm("¿Salir de la partida en curso?")) {
      window.history.pushState(null, "", window.location.pathname + window.location.search + rutaPanel);
      return;
    }
    desdeHistorialRef.current = alCargar ? "cargando" : true;
    const [, a, b] = window.location.hash.match(/^#\/app\/([a-z]+)(?:\/(.+))?$/) || [];
    if (a === "juego" && JUEGOS_RUTA.includes(b)) {
      navegar("inicio");
      selectGame(b);
    } else if (a === "ludo") {
      navegar("inicio");
      selectGame("ludo");
    } else if (a === "clases") {
      navegar("clases");
      if (b) setClaseAbierta(decodeURIComponent(b));
    } else {
      navegar(RUTAS_PANEL.includes(a) ? a : "inicio");
    }
  };
  useEffect(() => {
    const alCambiar = () => aplicarRutaRef.current?.();
    window.addEventListener("popstate", alCambiar);
    return () => window.removeEventListener("popstate", alCambiar);
  }, []);

  // ---------------- Enrutamiento por pantallas ----------------

  // Mientras se valida la sesión guardada mostramos una pantalla de carga breve
  if (!authReady) {
    return (
      <div className="cp app splash cp-splash" role="status" aria-label="Cargando YachayPlay">
        <Marca />
      </div>
    );
  }

  // Marco con menú lateral para las pantallas de configuración del docente (Ludo y Crucigrama).
  // Las pantallas en vivo (sala, tablero, proyección) siguen a pantalla completa.
  // Navegación del menú de arriba (la usan el inicio y todas las pantallas dentro del marco).
  const navegar = (id) => {
    clearGameSession();
    setCatalogGame(null);
    limpiarClaseDestino(); // salir del flujo "lanzar desde una clase"
    setCodigoInicial("");
    if (id === "clases") setClaseAbierta(null);
    if (["stats", "questions", "profile", "planes", "contacto", "clases"].includes(id)) return setToolPage(id);
    setToolPage(null);
    if (id === "join") return chooseMode("student");
    setSeccion(id === "juegos" || id === "herramientas" ? id : "inicio");
  };
  // ---- Clases ----
  // El docente lanza una actividad desde una clase: se recuerda la clase y se abre el juego.
  const lanzarEnClase = (clase, juego) => {
    clearGameSession();
    setToolPage(null);
    setCodigoInicial("");
    setClaseDestino(clase);
    selectGame(juego);
  };
  // El estudiante entra a una actividad en vivo de su clase: se abre el juego con el código puesto.
  const entrarActividad = (a) => {
    clearGameSession();
    setToolPage(null);
    if (a.kind === "ludo") {
      setJoinCode(a.code);
      setCatalogGame(null);
      chooseMode("student");
      return;
    }
    setCodigoInicial(a.code);
    selectGame(a.kind);
  };
  const abrirClase = (id) => {
    clearGameSession();
    setCatalogGame(null);
    setClaseAbierta(id);
    setToolPage("clases");
  };

  const enMenu = (activo, pagina, hoja = false) =>
    user ? (
      <AppShell user={user} active={activo} onNavigate={navegar} onLogout={logout} buildVersion={BUILD_VERSION} sheet={hoja}>
        {pagina}
      </AppShell>
    ) : (
      pagina
    );

  // --- Enlaces del correo (verificar / restablecer): van primero, aunque haya una partida o modo guardado ---
  if (verifyToken) {
    return <VerifyEmailScreen token={verifyToken} onDone={() => { setVerifyToken(null); window.location.reload(); }} />; // recarga: así el perfil ya muestra el correo verificado
  }
  if (resetToken) {
    return <ResetPasswordScreen token={resetToken} onDone={() => { setResetToken(null); setAuthScreen("login"); }} />;
  }

  if (!mode) {
  if (challenge2fa) {
    return (
      <TwoFactorStep
        challenge={challenge2fa}
        onSuccess={(r) => { setChallenge2fa(null); handleAuthSuccess(r); }}
        onCancel={() => setChallenge2fa(null)}
      />
    );
  }
  if (olvide) return <ForgotPasswordScreen onBack={() => setOlvide(false)} />;
    if (authScreen) {
      return (
        <AuthScreen
          tab={authScreen}
          setTab={setAuthScreen}
          onSuccess={handleAuthSuccess}
          onForgot={() => setOlvide(true)}
          onNeeds2FA={setChallenge2fa}
          onBack={() => setAuthScreen(null)}
          onGuest={() => {
            setAuthScreen(null);
            setCatalogGame("ludo");
            chooseMode("student");
          }}
        />
      );
    }
    if (toolPage && user) {
      if (toolPage === "clases") {
        return enMenu("clases", <ClasesPage user={user} initialId={claseAbierta} onCambiar={setClaseAbierta} onLanzar={lanzarEnClase} onEntrar={entrarActividad} />);
      }
      if (toolPage === "planes" || toolPage === "contacto") {
        return enMenu(toolPage, <InfoPage page={toolPage} onNavigate={navegar} />);
      }
      const volver = () => navegar("home");
      const conMenu = (activo, pagina) => enMenu(activo, pagina);
      if (toolPage === "profile") {
        return conMenu(
          "profile",
          <ProfilePage
            user={user}
            goHome={volver}
            onUserUpdate={setUser}
            onOpenStats={() => setToolPage("stats")}
            onOpenQuestions={() => setToolPage("questions")}
          />
        );
      }
      return toolPage === "questions" && user.role === "docente"
        ? conMenu("questions", <QuestionBankPage goHome={volver} />)
        : conMenu("stats", <StatsPage user={user} goHome={volver} />);
    }
    // Herramientas para el docente: no necesitan cuenta ni servidor
    if (catalogGame === "cronometro") return <Cronometro goHome={changeDevice} />;
    if (catalogGame === "ruleta") return <Ruleta goHome={changeDevice} />;
    if (catalogGame === "pizarra") return <Pizarra goHome={changeDevice} />;
    if (catalogGame === "estudio") {
      return (
        <Estudio
          user={user}
          initialCode={codigoInicial}
          goHome={() => setCatalogGame(null)}
          onLogin={() => setAuthScreen("login")}
          onRegister={() => setAuthScreen("register")}
        />
      );
    }
    if (catalogGame === "evaluacion") {
      return (
        <Evaluacion
          user={user}
          initialCode={codigoInicial}
          goHome={() => setCatalogGame(null)}
          onLogin={() => setAuthScreen("login")}
          onRegister={() => setAuthScreen("register")}
        />
      );
    }
    if (catalogGame === "palabra") return <PalabraRelampago goHome={() => setCatalogGame(null)} frame={(pagina) => enMenu("juegos", pagina, false)} />;
    if (catalogGame === "crucigrama") {
      return (
        <CrosswordGame
          user={user}
          initialCode={codigoInicial}
          onLogin={() => setAuthScreen("login")}
          onRegister={() => setAuthScreen("register")}
          goHome={() => setCatalogGame(null)}
          frame={(pagina) => enMenu("juegos", pagina)}
        />
      );
    }
    if (!catalogGame) {
      return (
        <>
          <GameCatalog
            onSelectGame={selectGame}
            onJoinWithCode={(codigo) => {
              // Desde la portada o el inicio se puede escribir el código: llega prellenado.
              if (typeof codigo === "string" && codigo) setJoinCode(codigo);
              chooseMode("student");
            }}
            buildVersion={BUILD_VERSION}
            user={user}
            onLogin={() => setAuthScreen("login")}
            onRegister={() => setAuthScreen("register")}
            onLogout={logout}
            onOpenStats={() => setToolPage("stats")}
            onOpenQuestions={() => setToolPage("questions")}
            onOpenProfile={() => setToolPage("profile")}
            section={seccion}
            onNavigate={navegar}
            onOpenClass={abrirClase}
            onEnterActivity={entrarActividad}
          />
        </>
      );
    }
    // Sin cuenta: se invita a iniciar sesión, crear cuenta o entrar como invitado
    return (
      <ChooserScreen
        onLogin={() => setAuthScreen("login")}
        onRegister={() => setAuthScreen("register")}
        onGuest={() => chooseMode("student")}
        onBack={() => setCatalogGame(null)}
      />
    );
  }

  if (mode === "engineer") {
    if (!gameCode) {
      return enMenu(
        "juegos",
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
          goHome={changeDevice}
        />
      );
    }
    if (!serverState) return <LoadingScreen code={gameCode} error={connError} onReset={changeDevice} />;

    if (serverState.phase === "lobby") {
      return (
        <>
        <LobbyScreen
          gameName={serverState.name}
          gameCode={gameCode}
          teams={serverState.teams}
          activeTeams={serverState.activeTeams}
          connectedByTeam={connectedByTeam}
          players={serverState.players}
          startGame={startGame}
          newGame={newGame}
          changeDevice={changeDevice}
        />
        </>
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
      <>
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
      </>
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
        goHome={changeDevice}
        onLogin={() => { changeDevice(); setAuthScreen("login"); }}
        onRegister={() => { changeDevice(); setAuthScreen("register"); }}
        isLogged={!!user}
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
          myTeam={studentTeam}
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

export default App;