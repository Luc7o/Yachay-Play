import React from "react";
import "./publicAula.css";

// Cabecera única para la portada y el ingreso de estudiantes.
export const PUBLIC_NAV = [
  { id: "inicio", label: "Inicio" },
  { id: "juegos", label: "Juegos" },
  { id: "caracteristicas", label: "Características" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "planes", label: "Planes" },
  { id: "contacto", label: "Contacto" },
];

export function PublicAulaHeader({ activePage = null, onNavigate, onLogin, onRegister }) {
  const [theme, setTheme] = React.useState(() => document.documentElement.dataset.theme || "light");
  React.useEffect(() => {
    const sync = () => setTheme(document.documentElement.dataset.theme || "light");
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const toggleTheme = () => {
    const next = (document.documentElement.dataset.theme || theme) === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem("yp_theme", next); } catch { /* sin almacenamiento */ }
  };
  return (
    <header className="pa-header">
      <div className="pa-header-inner">
        <a className="pa-logo" href="#/inicio" onClick={() => onNavigate?.("inicio")} aria-label="YachayPlay, inicio">
          <img className="pa-logo-light" src="/logo-aula.png" alt="YachayPlay" />
          <img className="pa-logo-dark" src="/logo-aula-dark.png" alt="" aria-hidden="true" />
        </a>
        <nav className="pa-nav" aria-label="Navegación principal">
          {PUBLIC_NAV.map(item => <a key={item.id} className={activePage === item.id ? "active" : ""} href={`#/${item.id}`} onClick={() => onNavigate?.(item.id)} aria-current={activePage === item.id ? "page" : undefined}>{item.label}</a>)}
        </nav>
        <div className="pa-auth">
          <button type="button" className="pa-theme" onClick={toggleTheme} aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span className="pa-theme-label">{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>
          <button type="button" className="pa-login" onClick={onLogin}>Iniciar sesión</button>
          <button type="button" className="pa-signup" onClick={onRegister}>Crear cuenta</button>
        </div>
      </div>
    </header>
  );
}

