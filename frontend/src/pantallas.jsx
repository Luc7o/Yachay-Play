import { lazy } from "react";
import { InfoPage } from "./InfoPages";

// ============================================================================
// QUÉ SE MUESTRA EN CADA RUTA del panel y de los juegos. App.jsx decide CUÁL
// (según la dirección); aquí solo se arma cada pantalla con sus datos.
// ============================================================================

// Pantallas que se cargan bajo demanda: un alumno que entra a Ludo desde el celular
// no descarga la Pizarra, la Ruleta, el Estudio, etc. (el Suspense está en main.jsx y en AppShell).
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

/**
 * Páginas del panel con sesión (#/app/clases, stats, questions, profile, planes, contacto).
 * enMenu(activo, pagina) las envuelve con el menú lateral.
 */
export function paginaPanel({ pagina, claseId, user, setUser, enMenu, navegar, irA, clases }) {
  if (pagina === "clases")
    return enMenu(
      "clases",
      <ClasesPage
        user={user}
        initialId={claseId}
        onCambiar={(id) => irA(id ? `/app/clases/${encodeURIComponent(id)}` : "/app/clases")}
        onLanzar={clases.lanzar}
        onEntrar={clases.entrar}
      />,
    );
  if (pagina === "planes" || pagina === "contacto")
    return enMenu(pagina, <InfoPage page={pagina} onNavigate={navegar} />);
  if (pagina === "profile")
    return enMenu(
      "profile",
      <ProfilePage
        user={user}
        onUserUpdate={setUser}
        onOpenStats={() => irA("/app/stats")}
        onOpenQuestions={() => irA("/app/questions")}
      />,
    );
  if (pagina === "questions" && user.role === "docente") return enMenu("questions", <QuestionBankPage />);
  return enMenu("stats", <StatsPage user={user} />);
}

/**
 * Juegos y herramientas (#/juego/<id> y #/app/juego/<id>), salvo Ludo (ver ludo/LudoPantallas.jsx).
 * pedirCuenta("login" | "register"): manda a iniciar sesión y vuelve a este juego después.
 */
export function pantallaJuego({ juego, user, codigo, nombre, volver, salir, pedirCuenta, enMenu }) {
  const cuenta = { onLogin: () => pedirCuenta("login"), onRegister: () => pedirCuenta("register") };
  const comun = { user, initialCode: codigo, initialName: nombre, goHome: volver };
  switch (juego) {
    // Herramientas para el docente: no necesitan cuenta ni servidor
    case "cronometro":
      return <Cronometro goHome={salir} />;
    case "ruleta":
      return <Ruleta goHome={salir} />;
    case "pizarra":
      return <Pizarra goHome={salir} />;
    case "estudio":
      return <Estudio {...comun} {...cuenta} />;
    case "evaluacion":
      return <Evaluacion {...comun} {...cuenta} />;
    case "palabra":
      return <PalabraRelampago {...comun} frame={(pagina) => enMenu("juegos", pagina)} />;
    case "crucigrama":
      return <CrosswordGame {...comun} {...cuenta} startJoin={!!nombre} frame={(pagina) => enMenu("juegos", pagina)} />;
    default:
      return null;
  }
}
