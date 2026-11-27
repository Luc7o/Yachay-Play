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
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--cp-logo-bg)" />
            <path
              d="M8 9h4v4h4v4h4v-4h4V9"
              fill="none"
              stroke="var(--cp-logo-fg)"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M16 17v7" stroke="var(--cp-logo-fg)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <span>
            yachay<b>play</b>
          </span>
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
          <button type="button" className="cp-btn quiet" onClick={onLogin}>
            Iniciar sesión
          </button>
          <button type="button" className="cp-btn dark" onClick={onRegister}>
            Crear cuenta
          </button>
        </div>
      </div>
    </header>
  );
}

// Re-exportado por comodidad para quien quiera la marca suelta.
export { Marca };
