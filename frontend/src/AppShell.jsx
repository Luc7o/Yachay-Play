import React from "react";
import "./shell.css";
import { Icono, Marca, BotonTema } from "./campusUi";

// ============================================================================
// MARCO DE LA APP para cuentas con sesión — diseño "Campus" (ver campus.css).
// Menú lateral en computadora; en celular pasa a ser una barra arriba.
// Lo usan el inicio, Estadísticas, Mis preguntas, Mi perfil y las pantallas de
// configuración de Ludo y Crucigrama.
//
// Para agregar una opción al menú: añádela a NAV_DOCENTE / NAV_ESTUDIANTE y
// maneja su id en onNavigate (App.jsx).
// ============================================================================

const NAV_DOCENTE = [
  { id: "home", label: "Inicio", icono: Icono.inicio },
  { id: "clases", label: "Mis clases", icono: Icono.clases },
  { id: "juegos", label: "Juegos", icono: Icono.juegos },
  { id: "herramientas", label: "Herramientas", icono: Icono.herramientas },
  { id: "questions", label: "Mis preguntas", icono: Icono.preguntas },
  { id: "stats", label: "Estadísticas", icono: Icono.stats },
];

const NAV_ESTUDIANTE = [
  { id: "home", label: "Inicio", icono: Icono.inicio },
  { id: "clases", label: "Mis clases", icono: Icono.clases },
  { id: "join", label: "Unirme con código", icono: Icono.codigo },
  { id: "juegos", label: "Juegos", icono: Icono.juegos },
  { id: "stats", label: "Mis resultados", icono: Icono.stats },
];

const NAV_INFO = [
  { id: "planes", label: "Planes" },
  { id: "contacto", label: "Ayuda y contacto" },
];

function Item({ it, active, onNavigate }) {
  const Ico = it.icono || Icono.info;
  return (
    <button
      type="button"
      className={active === it.id ? "active" : ""}
      aria-current={active === it.id ? "page" : undefined}
      onClick={() => onNavigate(it.id)}
    >
      <Ico />
      {it.label}
    </button>
  );
}

// sheet: pantallas antiguas (configuración de partida) que solo tienen diseño claro;
// se muestran sobre una hoja clara para que se lean también en modo oscuro.
export function AppShell({ user, active, onNavigate, onLogout, buildVersion, sheet = false, children }) {
  const esDocente = user.role === "docente";
  const items = esDocente ? NAV_DOCENTE : NAV_ESTUDIANTE;
  const iniciales = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="cp cp-shell">
      <aside className="cp-side" aria-label="Menú">
        <Marca onClick={() => onNavigate("home")} label="Ir al inicio" />

        <button type="button" className="cp-btn primary" onClick={() => onNavigate(esDocente ? "juegos" : "join")}>
          {esDocente ? "+ Crear partida" : "Unirme con código"}
        </button>

        <nav className="cp-side-nav" aria-label="Secciones">
          {items.map((it) => (
            <Item key={it.id} it={it} active={active} onNavigate={onNavigate} />
          ))}
          <span className="cp-side-label" style={{ marginTop: 18 }}>Información</span>
          {NAV_INFO.map((it) => (
            <Item key={it.id} it={it} active={active} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="cp-side-foot">
          <button
            type="button"
            className={"cp-side-user" + (active === "profile" ? " active" : "")}
            onClick={() => onNavigate("profile")}
            aria-label="Mi perfil"
            aria-current={active === "profile" ? "page" : undefined}
          >
            <span className="cp-avatar" aria-hidden="true">{iniciales || "?"}</span>
            <span style={{ minWidth: 0 }}>
              <strong>{user.name}</strong>
              <small>{esDocente ? "Docente" : "Estudiante"} · Mi perfil</small>
            </span>
          </button>
          <div className="cp-side-row">
            <BotonTema />
            <button type="button" className="cp-btn quiet" onClick={onLogout} aria-label="Salir">
              <Icono.salir />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="cp-main">
        <main className="sh-content">{sheet ? <div className="sh-sheet">{children}</div> : children}</main>
        {buildVersion && (
          <footer className="build-mark">
            YachayPlay · Build {buildVersion} · <a href="/politica-de-privacidad.html" target="_blank" rel="noopener noreferrer">Privacidad</a> · <a href="/terminos-y-condiciones.html" target="_blank" rel="noopener noreferrer">Términos</a>
          </footer>
        )}
      </div>
    </div>
  );
}
