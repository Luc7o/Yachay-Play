import React, { useEffect, useState } from "react";
import "./shell.css";

// ============================================================================
// MARCO DE LA APP (menú lateral + barra superior) para cuentas con sesión.
// Lo usan el inicio, Estadísticas, Mis preguntas y Mi perfil.
// Para agregar una opción al menú: añádela a NAV_DOCENTE / NAV_ESTUDIANTE y
// maneja su id en onNavigate (GameCatalog.jsx y App.jsx).
// ============================================================================

const ICONS = {
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  games: (
    <>
      <rect x="2" y="7" width="20" height="11" rx="4" />
      <path d="M7 10v5M4.5 12.5h5" />
      <circle cx="16" cy="11.5" r="1" />
      <circle cx="18.5" cy="14" r="1" />
    </>
  ),
  tools: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  chart: <path d="M5 20V11M12 20V4M19 20v-6M3 20h18" />,
  book: (
    <>
      <path d="M4 4h12a3 3 0 013 3v13H7a3 3 0 01-3-3V4z" />
      <path d="M8 9h7M8 13h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  logout: <path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M16 8l4 4-4 4M20 12H9" />,
  chevL: <path d="M15 6l-6 6 6 6" />,
  chevR: <path d="M9 6l6 6-6 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
};

export function Icon({ name }) {
  return (
    <svg className="sh-ico" viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const NAV_DOCENTE = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "juegos", label: "Juegos", icon: "games" },
  { id: "herramientas", label: "Herramientas", icon: "tools" },
  { id: "stats", label: "Estadísticas", icon: "chart" },
  { id: "questions", label: "Mis preguntas", icon: "book" },
  { id: "profile", label: "Mi perfil", icon: "user" },
];

const NAV_ESTUDIANTE = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "join", label: "Unirme con código", icon: "phone" },
  { id: "stats", label: "Mis resultados", icon: "chart" },
  { id: "profile", label: "Mi perfil", icon: "user" },
];

export function AppShell({ user, active, onNavigate, onLogout, buildVersion, children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("yp_sidebar") === "1";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false); // menú desplegable en celular

  useEffect(() => {
    try {
      localStorage.setItem("yp_sidebar", collapsed ? "1" : "0");
    } catch {
      /* modo privado: no se recuerda el estado del menú */
    }
  }, [collapsed]);

  const esDocente = user.role === "docente";
  const items = esDocente ? NAV_DOCENTE : NAV_ESTUDIANTE;
  const go = (id) => {
    setOpen(false);
    onNavigate(id);
  };

  return (
    <div className={"shell" + (collapsed ? " is-collapsed" : "") + (esDocente ? " has-fab" : "")}>
      {open && <div className="sh-backdrop" onClick={() => setOpen(false)} />}

      <aside className={"sh-side" + (open ? " is-open" : "")}>
        <button className="sh-logo" onClick={() => go("home")} aria-label="Ir al inicio">
          <img className="sh-logo-full" src="/logo-white.png" alt="YachayPlay" />
          <img className="sh-logo-mini" src="/favicon-32.png" alt="YachayPlay" />
        </button>

        <nav className="sh-nav" aria-label="Navegación principal">
          {items.map((it) => (
            <button
              key={it.id}
              className={"sh-item" + (active === it.id ? " active" : "")}
              onClick={() => go(it.id)}
              title={it.label}
              aria-current={active === it.id ? "page" : undefined}
            >
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </button>
          ))}
        </nav>

        <div className="sh-foot">
          <button className="sh-item" onClick={onLogout} title="Cerrar sesión">
            <Icon name="logout" />
            <span>Cerrar sesión</span>
          </button>
          <button
            className="sh-item sh-collapse"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expandir menú" : "Plegar menú"}
            aria-label={collapsed ? "Expandir menú" : "Plegar menú"}
          >
            <Icon name={collapsed ? "chevR" : "chevL"} />
            <span>Plegar menú</span>
          </button>
        </div>
      </aside>

      <div className="sh-body">
        <header className="sh-top">
          <button className="sh-burger" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Icon name="menu" />
          </button>
          <button className="sh-user" onClick={() => go("profile")} title="Ver mi perfil">
            <i>{user.name.trim().charAt(0).toUpperCase()}</i>
            <span>
              <b>{user.name.split(" ")[0]}</b>
              <small>{esDocente ? "Docente" : "Estudiante"}</small>
            </span>
          </button>
        </header>

        <div className="sh-content">{children}</div>
        {buildVersion && <footer className="build-mark">YachayPlay · Build {buildVersion}</footer>}
      </div>
    </div>
  );
}
