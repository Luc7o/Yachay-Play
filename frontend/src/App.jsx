import { lazy, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useBlocker, useLocation, useNavigate } from "react-router-dom";
import { base, leerRuta } from "./rutas";
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
import { JoinHub } from "./screens/JoinHub";
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

function App() {
  const [mode, setMode] = useState(() => leerLocal("ludo_mode") || null);
  // Qué pantalla se ve lo dice la ruta (ver rutas.js); aquí solo se lee.
  const location = useLocation();
  const navigate = useNavigate();
  const ruta = useMemo(() => leerRuta(location.pathname), [location.pathname]);
  const catalogGame = ruta.ludo ? "ludo" : ruta.juego;
  const toolPage = ruta.pagina;
  const claseAbierta = ruta.claseId;
  const unirseHub = ruta.unirse;
  // Última sección del panel visitada: a ella se vuelve al salir de un juego o herramienta.
  const ultimaSeccionRef = useRef("inicio");
  if (ruta.seccion) ultimaSeccionRef.current = ruta.seccion;
  const [codigoInicial, setCodigoInicial] = useState(""); // código para prellenar al entrar a un juego desde una clase
  const [nombreInvitado, setNombreInvitado] = useState(""); // nombre escrito en esa pantalla, para no pedirlo de nuevo

  // La ventanita del cronómetro (fuera de App) pide abrir su pantalla con este evento.
  // No se ofrece durante una partida de Ludo, para no sacar a nadie de ella sin querer.
  const abrirHerramientaRef = useRef(null);
  abrirHerramientaRef.current = (id) => selectGame(id);
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
  const authScreen = ruta.auth || null; // "login" | "register" (#/entrar, #/registro)
  const setAuthScreen = (t) => navigate(t === "login" ? "/entrar" : t === "register" ? "/registro" : "/");
  const [tab, setTab] = useState("game");
  const [selected, setSelected] = useState(null);
  const [bank, setBank] = useState([]);
  const [challenge2fa, setChallenge2fa] = useState(null); // 2.º paso del login (cuenta con 2FA)
  const olvide = !!ruta.olvide; // #/olvide
  // Enlaces del correo (#/restablecer/<token>, #/verificar/<token>): el token se guarda en memoria
  // y se saca de la barra de direcciones apenas se lee.
  const [resetToken, setResetToken] = useState(() => ruta.restablecer || null);
  const [verifyToken, setVerifyToken] = useState(() => ruta.verificar || null);
  useEffect(() => {
    if (ruta.restablecer || ruta.verificar) navigate("/", { replace: true });
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
    if (roleParam === "student" && !mode) {
      setMode("student");
      navigate("/ludo", { replace: true });
    }
  }, []); // eslint-disable-line

  // Al abrir la app con una partida de Ludo guardada (o con el enlace ?role=student), se va a Ludo.
  // Y con sesión, entrar a #/app/ludo directamente (recargar, flechas) elige el rol de la cuenta.
  const ludoInicialRef = useRef(false);
  useEffect(() => {
    if (!authReady) return;
    if (!ludoInicialRef.current) {
      ludoInicialRef.current = true;
      if (mode && !ruta.ludo) return navigate(`${base(user)}/ludo`, { replace: true });
    }
    if (ruta.ludo && !mode && user) chooseMode(user.role === "docente" ? "engineer" : "student");
  }, [authReady, ruta.ludo]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // "Unirme con código" / "Entrar como invitado": primero se elige a QUÉ se une (Ludo, Crucigrama,
  // Presentación, Evaluación), porque cada uno tiene sus propios códigos.
  function abrirUnirse(codigo = "") {
    setCodigoInicial(typeof codigo === "string" ? codigo : "");
    navigate(`${base(user)}/unirse`);
  }
  // Ya eligió: se abre la pantalla de unirse de ese juego, con el nombre (y el código, si lo había) puestos.
  function unirseA(juego, { code, name }) {
    setNombreInvitado(name);
    setCodigoInicial(code);
    if (juego === "ludo") {
      setStudentName(name);
      setJoinCode(code);
      chooseMode("student");
      navigate(`${base(user)}/ludo`);
      return;
    }
    selectGame(juego);
  }
  // El nombre escrito solo sirve mientras se está dentro del juego elegido.
  useEffect(() => {
    if (!catalogGame) setNombreInvitado("");
  }, [catalogGame]);

  // Borra lo que quedó de una partida anterior (no toca la sesión de la cuenta).
  function clearGameSession() {
    salidaElegidaRef.current = true; // salir a propósito (botón o menú): sin pedir confirmación
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
    volverAlCatalogo();
  }
  // Sale de un juego o herramienta: con sesión, a la sección del panel de la que venía; sin sesión, a la portada.
  function volverAlCatalogo() {
    navigate(user ? `/app/${ultimaSeccionRef.current}` : "/");
  }

  // Elegir un juego en el catálogo. Con cuenta, el rol ya se conoce: se entra directo.
  function selectGame(id) {
    // Si quedó una partida de Ludo a medias de una sesión anterior (el "mode"
    // se guarda en el navegador y solo se borra al pulsar "Volver al inicio"),
    // hay que limpiarla ANTES de entrar a otro juego; si no, esa partida vieja
    // secuestra la pantalla sin importar qué juego se elija ahora.
    if (id !== "ludo" && mode) clearGameSession();
    // Cada juego nuevo maneja su propio flujo (ver más abajo); solo Ludo usa "mode".
    if (user && id === "ludo") chooseMode(user.role === "docente" ? "engineer" : "student");
    navigate(id === "ludo" ? `${base(user)}/ludo` : `${base(user)}/juego/${id}`);
  }

  function handleAuthSuccess({ token, user: u }) {
    setToken(token);
    reconnectSocket(); // el servidor debe ver el token nuevo
    clearGameSession();
    setUser(u);
    window.dispatchEvent(new Event("yachay-auth-changed")); // para que el Asistente IA (fuera de App) se entere
    // Si eligió un juego antes de iniciar sesión, sigue en ese juego; si no, entra al inicio del panel.
    if (juegoAntesDeEntrarRef.current === "ludo") {
      chooseMode(u.role === "docente" ? "engineer" : "student");
      navigate("/app/ludo", { replace: true });
    } else if (juegoAntesDeEntrarRef.current)
      navigate(`/app/juego/${juegoAntesDeEntrarRef.current}`, { replace: true });
    else navigate("/app/inicio", { replace: true });
    juegoAntesDeEntrarRef.current = null;
  }

  function logout() {
    setToken(null);
    reconnectSocket();
    setUser(null);
    setStudentName("");
    window.dispatchEvent(new Event("yachay-auth-changed")); // ídem: que el Asistente IA desaparezca al salir
    clearGameSession();
    navigate("/inicio", { replace: true }); // el botón de salir siempre regresa a la portada pública
  }

  const juegoAntesDeEntrarRef = useRef(null); // juego elegido sin sesión, para seguir en él al entrar
  const saliendoDeLudoRef = useRef(false);
  const salidaElegidaRef = useRef(false); // true mientras se sale de Ludo con un botón de la propia app
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

  // Salir de una partida de Ludo en curso con las flechas del navegador: se pide confirmación.
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !salidaElegidaRef.current &&
      !!mode &&
      !!(engineerGameCode || studentGameCode) &&
      leerRuta(currentLocation.pathname).ludo &&
      !leerRuta(nextLocation.pathname).ludo,
  );
  useEffect(() => {
    if (bloqueo.state !== "blocked") return;
    if (window.confirm("¿Salir de la partida en curso?")) {
      clearGameSession();
      bloqueo.proceed();
    } else bloqueo.reset();
  }, [bloqueo]);
  // Al dejar la ruta de Ludo (flechas, menú), se suelta la partida guardada.
  useEffect(() => {
    if (!ruta.ludo && mode && bloqueo.state === "unblocked" && authReady && saliendoDeLudoRef.current)
      clearGameSession();
    saliendoDeLudoRef.current = ruta.ludo;
    salidaElegidaRef.current = false;
  }, [ruta.ludo]); // eslint-disable-line react-hooks/exhaustive-deps

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
    limpiarClaseDestino(); // salir del flujo "lanzar desde una clase"
    setCodigoInicial("");
    if (id === "join") return abrirUnirse();
    if (["stats", "questions", "profile", "planes", "contacto", "clases"].includes(id)) return navigate(`/app/${id}`);
    navigate(user ? `/app/${id === "juegos" || id === "herramientas" ? id : "inicio"}` : "/");
  };
  // ---- Clases ----
  // El docente lanza una actividad desde una clase: se recuerda la clase y se abre el juego.
  const lanzarEnClase = (clase, juego) => {
    clearGameSession();
    setCodigoInicial("");
    setClaseDestino(clase);
    selectGame(juego);
  };
  // El estudiante entra a una actividad en vivo de su clase: se abre el juego con el código puesto.
  const entrarActividad = (a) => {
    clearGameSession();
    if (a.kind === "ludo") {
      setJoinCode(a.code);
      chooseMode("student");
      navigate(`${base(user)}/ludo`);
      return;
    }
    setCodigoInicial(a.code);
    selectGame(a.kind);
  };
  const abrirClase = (id) => {
    clearGameSession();
    navigate(`/app/clases/${encodeURIComponent(id)}`);
  };
  const setClaseAbierta = (id) => navigate(id ? `/app/clases/${encodeURIComponent(id)}` : "/app/clases");
  const setToolPage = (p) => navigate(`/app/${p}`);

  const enMenu = (activo, pagina) =>
    user ? (
      <AppShell user={user} active={activo} onNavigate={navegar} onLogout={logout} buildVersion={BUILD_VERSION}>
        {pagina}
      </AppShell>
    ) : (
      pagina
    );

  // --- Enlaces del correo (verificar / restablecer): van primero, aunque haya una partida o modo guardado ---
  if (verifyToken) {
    return (
      <VerifyEmailScreen
        token={verifyToken}
        onDone={() => {
          setVerifyToken(null);
          window.location.reload();
        }}
      />
    ); // recarga: así el perfil ya muestra el correo verificado
  }
  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onDone={() => {
          setResetToken(null);
          navigate("/entrar", { replace: true });
        }}
      />
    );
  }

  if (!mode) {
    if (challenge2fa) {
      return (
        <TwoFactorStep
          challenge={challenge2fa}
          onSuccess={(r) => {
            setChallenge2fa(null);
            handleAuthSuccess(r);
          }}
          onCancel={() => setChallenge2fa(null)}
        />
      );
    }
    if (olvide) return <ForgotPasswordScreen onBack={() => navigate("/entrar")} />;
    // Con sesión, la portada y las pantallas de cuenta llevan al panel; sin sesión, el panel lleva a la portada.
    if (user && (ruta.portada || ruta.auth)) return <Navigate to="/app/inicio" replace />;
    if (!user && ruta.enPanel) {
      if (ruta.juego) return <Navigate to={`/juego/${ruta.juego}`} replace />;
      if (ruta.unirse) return <Navigate to="/unirse" replace />;
      return <Navigate to="/" replace />;
    }
    if (ruta.desconocida) return <Navigate to="/app/inicio" replace />;
    if (authScreen) {
      return (
        <AuthScreen
          tab={authScreen}
          setTab={setAuthScreen}
          onSuccess={handleAuthSuccess}
          onForgot={() => navigate("/olvide")}
          onNeeds2FA={setChallenge2fa}
          onBack={() => navigate("/")}
          onGuest={() => abrirUnirse()}
        />
      );
    }
    if (toolPage && user) {
      if (toolPage === "clases") {
        return enMenu(
          "clases",
          <ClasesPage
            user={user}
            initialId={claseAbierta}
            onCambiar={setClaseAbierta}
            onLanzar={lanzarEnClase}
            onEntrar={entrarActividad}
          />,
        );
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
          />,
        );
      }
      return toolPage === "questions" && user.role === "docente"
        ? conMenu("questions", <QuestionBankPage goHome={volver} />)
        : conMenu("stats", <StatsPage user={user} goHome={volver} />);
    }
    // Invitado o estudiante: primero elige a qué se une
    if (unirseHub) {
      return enMenu(
        "join",
        <JoinHub
          user={user}
          initialCode={codigoInicial}
          initialName={nombreInvitado}
          onPick={unirseA}
          onBack={volverAlCatalogo}
        />,
      );
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
          initialName={nombreInvitado}
          goHome={volverAlCatalogo}
          onLogin={() => {
            juegoAntesDeEntrarRef.current = catalogGame;
            setAuthScreen("login");
          }}
          onRegister={() => {
            juegoAntesDeEntrarRef.current = catalogGame;
            setAuthScreen("register");
          }}
        />
      );
    }
    if (catalogGame === "evaluacion") {
      return (
        <Evaluacion
          user={user}
          initialCode={codigoInicial}
          initialName={nombreInvitado}
          goHome={volverAlCatalogo}
          onLogin={() => {
            juegoAntesDeEntrarRef.current = catalogGame;
            setAuthScreen("login");
          }}
          onRegister={() => {
            juegoAntesDeEntrarRef.current = catalogGame;
            setAuthScreen("register");
          }}
        />
      );
    }
    if (catalogGame === "palabra")
      return (
        <PalabraRelampago
          goHome={volverAlCatalogo}
          user={user}
          initialCode={codigoInicial}
          initialName={nombreInvitado}
          frame={(pagina) => enMenu("juegos", pagina)}
        />
      );
    if (catalogGame === "crucigrama") {
      return (
        <CrosswordGame
          user={user}
          initialCode={codigoInicial}
          initialName={nombreInvitado}
          startJoin={!!nombreInvitado}
          onLogin={() => {
            juegoAntesDeEntrarRef.current = catalogGame;
            setAuthScreen("login");
          }}
          onRegister={() => {
            juegoAntesDeEntrarRef.current = catalogGame;
            setAuthScreen("register");
          }}
          goHome={volverAlCatalogo}
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
              // Desde la portada o el inicio se puede escribir el código: llega prellenado,
              // pero antes hay que elegir a qué se une (Ludo, Crucigrama, Presentación, Evaluación).
              abrirUnirse(codigo);
            }}
            buildVersion={BUILD_VERSION}
            user={user}
            onLogin={() => {
              juegoAntesDeEntrarRef.current = catalogGame;
              setAuthScreen("login");
            }}
            onRegister={() => {
              juegoAntesDeEntrarRef.current = catalogGame;
              setAuthScreen("register");
            }}
            onLogout={logout}
            onOpenStats={() => setToolPage("stats")}
            onOpenQuestions={() => setToolPage("questions")}
            onOpenProfile={() => setToolPage("profile")}
            section={ruta.seccion || "inicio"}
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
        onLogin={() => {
          juegoAntesDeEntrarRef.current = catalogGame;
          setAuthScreen("login");
        }}
        onRegister={() => {
          juegoAntesDeEntrarRef.current = catalogGame;
          setAuthScreen("register");
        }}
        onGuest={() => chooseMode("student")}
        onBack={volverAlCatalogo}
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
        />,
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
        onLogin={() => {
          changeDevice();
          setAuthScreen("login");
        }}
        onRegister={() => {
          changeDevice();
          setAuthScreen("register");
        }}
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
