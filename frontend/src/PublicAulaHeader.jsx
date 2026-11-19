import React from "react";
import { Marca, BotonTema } from "./campusUi";
// (campus.css se carga en main.jsx, al final, para que gane sobre los estilos antiguos.)

// Cabecera única para la portada y el ingreso de estudiantes (diseño "Campus").
// Los enlaces usan el hash (#/como-funciona...): la portada los convierte en
// desplazamiento hasta cada sección.
export const PUBLIC_NAV = [
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "docentes", label: "Docentes" },
  { id: "estudiantes", label: "Estudiantes" },
  { id: "juegos", label: "Juegos" },
];

export function PublicAulaHeader({ activePage = null, onNavigate, onLogin, onRegister }) {
  return (
    <header className="cp cp-pubhead">
      <div className="cp-wrap">
        <a className="cp-brand" href="#/inicio" onClick={() => onNavigate?.("inicio")} aria-label="YachayPlay, inicio">
          <svg viewBox="0 0 26 26" aria-hidden="true">
            <path d="M9 1h8v8h8v8h-8v8H9v-8H1V9h8z" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="11" y="11" width="4" height="4" fill="currentColor" />
          </svg>
          <span>yachay<b>play</b></span>
        </a>
        <nav className="cp-pubnav" aria-label="Navegación principal">
          {PUBLIC_NAV.map((item) => (
            <a
              key={item.id}
              className={activePage === item.id ? "active" : ""}
              href={`#/${item.id}`}
              onClick={() => onNavigate?.(item.id)}
              aria-current={activePage === item.id ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="cp-pubauth">
          <BotonTema />
          <button type="button" className="cp-btn quiet" onClick={onLogin}>Iniciar sesión</button>
          <button type="button" className="cp-btn dark" onClick={onRegister}>Crear cuenta</button>
        </div>
      </div>
    </header>
  );
}

// Re-exportado por comodidad para quien quiera la marca suelta.
export { Marca };
