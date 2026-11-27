// ============================================================================
// RUTAS DE LA APP (React Router, en el "#" de la URL)
// ----------------------------------------------------------------------------
// Las mismas direcciones de siempre, para no romper enlaces ni códigos QR:
//   Portada pública ......... #/  #/inicio  #/como-funciona  #/docentes  #/estudiantes  #/juegos
//   Cuenta .................. #/entrar  #/registro  #/olvide
//   Enlaces de correo ....... #/restablecer/<token>  #/verificar/<token>
//   Unirse con código ....... #/unirse            (con sesión: #/app/unirse)
//   Un juego o herramienta .. #/juego/<id>        (con sesión: #/app/juego/<id>)
//   Ludo .................... #/ludo              (con sesión: #/app/ludo)
//   Panel con sesión ........ #/app/inicio | juegos | herramientas | clases[/<id>]
//                             | stats | questions | profile | planes | contacto
//   ?code=123456&role=student (enlace / QR que reciben los estudiantes de Ludo)
// ============================================================================

export const JUEGOS_RUTA = [
  "ludo",
  "crucigrama",
  "palabra",
  "evaluacion",
  "estudio",
  "cronometro",
  "ruleta",
  "pizarra",
];
export const SECCIONES_PANEL = ["inicio", "juegos", "herramientas"];
export const PAGINAS_PANEL = ["stats", "questions", "profile", "planes", "contacto", "clases"];
const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

// Convierte la ruta en "qué pantalla mostrar". Nada de esto vive en el estado de React.
export function leerRuta(pathname) {
  const partes = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  const enPanel = partes[0] === "app";
  const [a, b] = enPanel ? partes.slice(1) : partes;
  const r = { enPanel, seccion: null, pagina: null, claseId: null, juego: null, ludo: false, unirse: false };

  if (!enPanel && a === "restablecer" && TOKEN.test(b || "")) return { ...r, restablecer: b };
  if (!enPanel && a === "verificar" && TOKEN.test(b || "")) return { ...r, verificar: b };
  if (!enPanel && a === "entrar") return { ...r, auth: "login" };
  if (!enPanel && a === "registro") return { ...r, auth: "register" };
  if (!enPanel && a === "olvide") return { ...r, olvide: true };

  if (a === "unirse") return { ...r, unirse: true };
  if (a === "ludo") return { ...r, ludo: true };
  if (a === "juego" && JUEGOS_RUTA.includes(b)) return b === "ludo" ? { ...r, ludo: true } : { ...r, juego: b };
  if (enPanel && a === "clases") return { ...r, pagina: "clases", claseId: b ? decodeURIComponent(b) : null };
  if (enPanel && PAGINAS_PANEL.includes(a) && !b) return { ...r, pagina: a };
  if (enPanel)
    return { ...r, seccion: SECCIONES_PANEL.includes(a) ? a : "inicio", desconocida: !SECCIONES_PANEL.includes(a) };
  return { ...r, portada: true };
}

// Prefijo de las rutas que existen con y sin sesión.
export const base = (user) => (user ? "/app" : "");
