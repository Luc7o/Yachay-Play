import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useBlocker, useLocation, useNavigate } from "react-router-dom";
import { base, leerRuta } from "./rutas";
import { GameCatalog } from "./GameCatalog";
import { AppShell } from "./AppShell";
import { EVENTO_ABRIR } from "./CronometroMini";
import { BUILD_VERSION } from "./constants";
import { setClaseDestino, limpiarClaseDestino } from "./claseDestino";
import { Marca } from "./campusUi";
import { ChooserScreen } from "./screens/ChooserScreen";
import { JoinHub } from "./screens/JoinHub";
import { useLudo } from "./ludo/useLudo";
import { LudoPantallas } from "./ludo/LudoPantallas";
import { useSesion } from "./sesion/useSesion";
import { usePantallaCuenta } from "./sesion/PantallaCuenta";
import { paginaPanel, pantallaJuego } from "./pantallas";
import type { SinTipo } from "./tipos";

// ============================================================================
// APP: decide QUÉ pantalla se ve según la dirección (ver rutas.ts).
//   - la sesión vive en sesion/useSesion.js y sus pantallas en sesion/PantallaCuenta.jsx
//   - Ludo, en ludo/useLudo.js y ludo/LudoPantallas.jsx
//   - el panel y los demás juegos, en pantallas.jsx
// ============================================================================
function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const ruta = useMemo(() => leerRuta(location.pathname), [location.pathname]);
  const catalogGame = ruta.ludo ? "ludo" : ruta.juego;
  // Última sección del panel visitada: a ella se vuelve al salir de un juego o herramienta.
  const ultimaSeccionRef = useRef("inicio");
  if (ruta.seccion) ultimaSeccionRef.current = ruta.seccion;
  const [codigoInicial, setCodigoInicial] = useState(""); // código para prellenar al entrar a un juego
  const [nombreInvitado, setNombreInvitado] = useState(""); // nombre escrito al unirse, para no pedirlo de nuevo
  const juegoAntesDeEntrarRef = useRef<SinTipo>(null); // juego elegido sin sesión, para seguir en él al entrar
  const saliendoDeLudoRef = useRef(false);
  const salidaElegidaRef = useRef(false); // true mientras se sale de Ludo con un botón de la propia app

  const { user, setUser, authReady, iniciar, cerrar } = useSesion();
  const ludo = useLudo({ user });
  const { mode, setMode, chooseMode, engineerGameCode, studentGameCode, setStudentName, setJoinCode } = ludo;
  const cuenta = usePantallaCuenta({
    ruta,
    alEntrar: handleAuthSuccess,
    alInvitado: () => abrirUnirse(),
    permitirLogin: !mode,
    conSesion: !!user,
  });

  // La ventanita del cronómetro (fuera de App) pide abrir su pantalla con este evento.
  const abrirHerramientaRef = useRef<SinTipo>(null);
  abrirHerramientaRef.current = (id: string) => selectGame(id);
  useEffect(() => {
    const abrir = (e) => e.detail && abrirHerramientaRef.current(e.detail);
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  // Solo un docente con sesión puede estar en el panel del docente de Ludo.
  useEffect(() => {
    if (authReady && mode === "engineer" && user?.role !== "docente") changeDevice();
  }, [authReady, user, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enlace / QR que reciben los estudiantes de Ludo: ?code=123456&role=student
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("role") === "student" && !mode) {
      setMode("student");
      navigate("/ludo", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Al abrir la app con una partida de Ludo guardada se va a Ludo; y con sesión, entrar a
  // #/app/ludo directamente (recargar, flechas) elige el rol de la cuenta.
  const ludoInicialRef = useRef(false);
  useEffect(() => {
    if (!authReady) return;
    if (!ludoInicialRef.current) {
      ludoInicialRef.current = true;
      if (mode && !ruta.ludo) return navigate(`${base(user)}/ludo`, { replace: true });
    }
    if (ruta.ludo && !mode && user) chooseMode(user.role === "docente" ? "engineer" : "student");
  }, [authReady, ruta.ludo]); // eslint-disable-line react-hooks/exhaustive-deps

  // El nombre escrito al unirse solo sirve mientras se está dentro del juego elegido.
  useEffect(() => {
    if (!catalogGame) setNombreInvitado("");
  }, [catalogGame]);

  // ---------------- acciones ----------------
  // "Unirme con código" / "Entrar como invitado": primero se elige A QUÉ se une, porque cada
  // juego tiene sus propios códigos.
  function abrirUnirse(codigo = "") {
    setCodigoInicial(typeof codigo === "string" ? codigo : "");
    navigate(`${base(user)}/unirse`);
  }
  // Ya eligió: se abre la pantalla de unirse de ese juego, con el nombre (y el código) puestos.
  function unirseA(juego: string, { code, name }) {
    setNombreInvitado(name);
    setCodigoInicial(code);
    if (juego !== "ludo") return selectGame(juego);
    setStudentName(name);
    setJoinCode(code);
    chooseMode("student");
    navigate(`${base(user)}/ludo`);
  }
  // Borra lo que quedó de una partida de Ludo (no toca la sesión de la cuenta).
  function clearGameSession() {
    salidaElegidaRef.current = true; // salir a propósito (botón o menú): sin pedir confirmación
    ludo.limpiar();
  }
  // "Salir" / "Volver al inicio" de una partida o herramienta.
  function changeDevice() {
    clearGameSession();
    volverAlCatalogo();
  }
  // Con sesión, a la sección del panel de la que venía; sin sesión, a la portada.
  function volverAlCatalogo() {
    navigate(user ? `/app/${ultimaSeccionRef.current}` : "/");
  }
  // Elegir un juego en el catálogo. Con cuenta, el rol ya se conoce: se entra directo.
  function selectGame(id: string) {
    // Una partida de Ludo a medias de antes se suelta ANTES de entrar a otro juego.
    if (id !== "ludo" && mode) clearGameSession();
    if (user && id === "ludo") chooseMode(user.role === "docente" ? "engineer" : "student");
    navigate(id === "ludo" ? `${base(user)}/ludo` : `${base(user)}/juego/${id}`);
  }
  // Pedir cuenta desde un juego: después de entrar se vuelve a ese juego.
  function pedirCuenta(tipo: string) {
    juegoAntesDeEntrarRef.current = catalogGame;
    navigate(tipo === "login" ? "/entrar" : "/registro");
  }
  function handleAuthSuccess(r) {
    clearGameSession();
    iniciar(r);
    const juego = juegoAntesDeEntrarRef.current;
    juegoAntesDeEntrarRef.current = null;
    if (juego === "ludo") {
      chooseMode(r.user.role === "docente" ? "engineer" : "student");
      navigate("/app/ludo", { replace: true });
    } else navigate(juego ? `/app/juego/${juego}` : "/app/inicio", { replace: true });
  }
  function logout() {
    cerrar();
    setStudentName("");
    clearGameSession();
    navigate("/inicio", { replace: true }); // salir siempre regresa a la portada pública
  }
  // Menú lateral (y botones del inicio)
  function navegar(id: string) {
    clearGameSession();
    limpiarClaseDestino(); // salir del flujo "lanzar desde una clase"
    setCodigoInicial("");
    if (id === "join") return abrirUnirse();
    if (["stats", "questions", "profile", "planes", "contacto", "clases"].includes(id)) return navigate(`/app/${id}`);
    navigate(user ? `/app/${id === "juegos" || id === "herramientas" ? id : "inicio"}` : "/");
  }
  // Clases: el docente lanza una actividad en una clase; el estudiante entra a una en vivo.
  const clases = {
    lanzar: (clase, juego: string) => {
      clearGameSession();
      setCodigoInicial("");
      setClaseDestino(clase);
      selectGame(juego);
    },
    entrar: (a) => {
      clearGameSession();
      if (a.kind !== "ludo") {
        setCodigoInicial(a.code);
        return selectGame(a.kind);
      }
      setJoinCode(a.code);
      chooseMode("student");
      navigate(`${base(user)}/ludo`);
    },
    abrir: (id) => {
      clearGameSession();
      navigate(`/app/clases/${encodeURIComponent(id)}`);
    },
  };

  // Salir de una partida de Ludo en curso con las flechas del navegador: se pide confirmación.
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }: { currentLocation?: SinTipo; nextLocation?: SinTipo }) =>
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

  // ---------------- qué se ve ----------------
  if (!authReady)
    return (
      <div className="cp app splash cp-splash" role="status" aria-label="Cargando YachayPlay">
        <Marca />
      </div>
    );
  if (cuenta) return cuenta;

  // Marco con menú lateral (solo con sesión)
  const enMenu = (activo, pagina) =>
    user ? (
      <AppShell user={user} active={activo} onNavigate={navegar} onLogout={logout} buildVersion={BUILD_VERSION}>
        {pagina}
      </AppShell>
    ) : (
      pagina
    );

  if (mode)
    return (
      <LudoPantallas
        ludo={ludo}
        user={user}
        changeDevice={changeDevice}
        enMenu={enMenu}
        setAuthScreen={(t: string) => navigate(t === "login" ? "/entrar" : "/registro")}
      />
    );

  // Con sesión, la portada y las pantallas de cuenta llevan al panel; sin sesión, el panel lleva a la portada.
  if (user && (ruta.portada || ruta.auth)) return <Navigate to="/app/inicio" replace />;
  if (!user && ruta.enPanel) {
    if (ruta.juego) return <Navigate to={`/juego/${ruta.juego}`} replace />;
    return <Navigate to={ruta.unirse ? "/unirse" : "/"} replace />;
  }
  if (ruta.desconocida) return <Navigate to="/app/inicio" replace />;

  if (ruta.pagina && user)
    return paginaPanel({
      pagina: ruta.pagina,
      claseId: ruta.claseId,
      user,
      setUser,
      enMenu,
      navegar,
      irA: navigate,
      clases,
    });
  // Invitado o estudiante: primero elige a qué se une
  if (ruta.unirse)
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
  if (ruta.juego)
    return pantallaJuego({
      juego: ruta.juego,
      user,
      codigo: codigoInicial,
      nombre: nombreInvitado,
      volver: volverAlCatalogo,
      salir: changeDevice,
      pedirCuenta,
      enMenu,
    });
  // Ludo sin cuenta: se invita a iniciar sesión, crear cuenta o entrar como invitado
  if (ruta.ludo)
    return (
      <ChooserScreen
        onLogin={() => pedirCuenta("login")}
        onRegister={() => pedirCuenta("register")}
        onGuest={() => chooseMode("student")}
        onBack={volverAlCatalogo}
      />
    );
  return (
    <GameCatalog
      user={user}
      section={ruta.seccion || "inicio"}
      buildVersion={BUILD_VERSION}
      onSelectGame={selectGame}
      onJoinWithCode={abrirUnirse} // el código llega prellenado, pero antes se elige a qué se une
      onLogin={() => pedirCuenta("login")}
      onRegister={() => pedirCuenta("register")}
      onLogout={logout}
      onOpenStats={() => navigate("/app/stats")}
      onOpenQuestions={() => navigate("/app/questions")}
      onOpenProfile={() => navigate("/app/profile")}
      onNavigate={navegar}
      onOpenClass={clases.abrir}
      onEnterActivity={clases.entrar}
    />
  );
}

export default App;
