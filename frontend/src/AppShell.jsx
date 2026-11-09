import React, { useState } from "react";
import "./shell.css";

// ============================================================================
// MARCO DE LA APP (encabezado con menú + tema claro/oscuro) para cuentas con sesión.
// Lo usan el inicio, Estadísticas, Mis preguntas, Mi perfil y las pantallas de
// configuración de Ludo y Crucigrama. Diseño "Aula Fresca".
//
// Para agregar una opción al menú: añádela a NAV_DOCENTE / NAV_ESTUDIANTE y
// maneja su id en onNavigate (App.jsx).
// ============================================================================

const NAV_DOCENTE = [
  { id: "home", label: "Inicio" },
  { id: "juegos", label: "Juegos" },
  { id: "herramientas", label: "Herramientas" },
  { id: "stats", label: "Estadísticas" },
  { id: "questions", label: "Mis preguntas" },
  { id: "planes", label: "Planes" },
  { id: "contacto", label: "Contacto" },
];

const NAV_ESTUDIANTE = [
  { id: "home", label: "Inicio" },
  { id: "join", label: "Unirme con código" },
  { id: "stats", label: "Mis resultados" },
  { id: "planes", label: "Planes" },
  { id: "contacto", label: "Contacto" },
];

// Tema: "light" | "dark". index.html lo decide antes de pintar; aquí solo se alterna y se recuerda.
function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("yp_theme", next);
    } catch {
      /* modo privado: el tema no se recuerda */
    }
    setTheme(next);
  };
  return [theme, toggle];
}

// sheet: pantallas antiguas (configuración de partida) que solo tienen diseño claro;
// se muestran sobre una hoja clara para que se lean también en modo oscuro.
export function AppShell({ user, active, onNavigate, onLogout, buildVersion, sheet = false, children }) {
  const [theme, toggleTheme] = useTheme();
  const esDocente = user.role === "docente";
  const items = esDocente ? NAV_DOCENTE : NAV_ESTUDIANTE;
  const oscuro = theme === "dark";

  return (
    <div className="shell">
      <header className="sh-header">
        <div className="sh-top">
          <button className="sh-logo" onClick={() => onNavigate("home")} aria-label="Ir al inicio">
            <img className="sh-logo-light" src="/logo-aula.png" alt="YachayPlay" />
            <img className="sh-logo-dark" src="/logo-aula-dark.png" alt="" aria-hidden="true" />
          </button>

          <nav className="sh-nav" aria-label="Secciones">
            {items.map((it) => (
              <button
                key={it.id}
                className={active === it.id ? "active" : ""}
                aria-current={active === it.id ? "page" : undefined}
                onClick={() => onNavigate(it.id)}
              >
                {it.label}
              </button>
            ))}
          </nav>

          <div className="sh-right">
            <button className="sh-theme" onClick={toggleTheme} aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
              <span aria-hidden="true">{oscuro ? "☀" : "☾"}</span> <span className="sh-theme-txt">{oscuro ? "Modo claro" : "Modo oscuro"}</span>
            </button>
            <button className="sh-create" onClick={() => onNavigate(esDocente ? "juegos" : "join")}>
              {esDocente ? "+ Crear partida" : "Unirme con código"}
            </button>
            <button
              className={"sh-avatar" + (active === "profile" ? " active" : "")}
              title="Mi perfil"
              aria-label="Mi perfil"
              onClick={() => onNavigate("profile")}
            >
              {user.name.trim().charAt(0).toUpperCase()}
            </button>
            <button className="sh-out" onClick={onLogout}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="sh-content">{sheet ? <div className="sh-sheet">{children}</div> : children}</main>
      {buildVersion && <footer className="build-mark">YachayPlay · Build {buildVersion}</footer>}
    </div>
  );
}
