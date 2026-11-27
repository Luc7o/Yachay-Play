import { lazy, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useBlocker, useLocation, useNavigate } from "react-router-dom";
import { base, leerRuta } from "./rutas";
import { api, getToken, setToken } from "./api";
import { reconnectSocket } from "./socket";
import { AuthScreen } from "./AuthScreen";
import { ForgotPasswordScreen, ResetPasswordScreen, TwoFactorStep, VerifyEmailScreen } from "./AuthExtras";
import { GameCatalog } from "./GameCatalog";
import { AppShell } from "./AppShell";
import { InfoPage } from "./InfoPages";
import { EVENTO_ABRIR } from "./CronometroMini";
import { BUILD_VERSION } from "./constants";
import { setClaseDestino, limpiarClaseDestino } from "./claseDestino";
import { Marca } from "./campusUi";
import { ChooserScreen } from "./screens/ChooserScreen";
import { JoinHub } from "./screens/JoinHub";
import { useLudo } from "./ludo/useLudo";
import { LudoPantallas } from "./ludo/LudoPantallas";

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

function App() {
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

  // --- Cuenta: quién es el usuario y qué rol tiene (se elige una sola vez al registrarse) ---
  const [user, setUser] = useState(null); // { id, name, email, role: "docente" | "estudiante" }
  const [authReady, setAuthReady] = useState(() => !getToken()); // false mientras se valida la sesión guardada
  // Ludo: estado, sockets y acciones viven en useLudo (ludo/useLudo.js)
  const ludo = useLudo({ user });
  const { mode, setMode, chooseMode, engineerGameCode, studentGameCode, setStudentName, setJoinCode } = ludo;
  const authScreen = ruta.auth || null; // "login" | "register" (#/entrar, #/registro)
  const setAuthScreen = (t) => navigate(t === "login" ? "/entrar" : t === "register" ? "/registro" : "/");
  const [challenge2fa, setChallenge2fa] = useState(null); // 2.º paso del login (cuenta con 2FA)
  const olvide = !!ruta.olvide; // #/olvide
  // Enlaces del correo (#/restablecer/<token>, #/verificar/<token>): el token se guarda en memoria
  // y se saca de la barra de direcciones apenas se lee.
  const [resetToken, setResetToken] = useState(() => ruta.restablecer || null);
  const [verifyToken, setVerifyToken] = useState(() => ruta.verificar || null);
  useEffect(() => {
    if (ruta.restablecer || ruta.verificar) navigate("/", { replace: true });
  }, []); // eslint-disable-line

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

  // Leer parámetros de la URL (para el enlace/QR que reciben los estudiantes)
  useEffect(() => {
    const roleParam = new URLSearchParams(window.location.search).get("role");
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
    ludo.limpiar();
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
  }, [bloqueo]); // eslint-disable-line react-hooks/exhaustive-deps
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

  return (
    <LudoPantallas ludo={ludo} user={user} changeDevice={changeDevice} enMenu={enMenu} setAuthScreen={setAuthScreen} />
  );
}

// ==================== Pantallas comunes ====================

export default App;
