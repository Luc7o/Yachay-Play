import React, { useState } from "react";

// ============================================================================
// PIEZAS COMPARTIDAS DEL DISEÑO "CAMPUS" (ver campus.css)
// Íconos de trazo (sin emojis), la marca y el botón de tema claro/oscuro.
// Logo "Tocapu": la Y escalonada de los textiles andinos (tocapus). Sus colores salen de
// --cp-logo-bg / --cp-logo-fg (campus.css), así se adapta a claro, oscuro y proyección.
// ============================================================================

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

export const Icono = {
  marca: () => (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--cp-logo-bg)" />
      <path d="M8 9h4v4h4v4h4v-4h4V9" fill="none" stroke="var(--cp-logo-fg)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M16 17v7" stroke="var(--cp-logo-fg)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  ),
  check: () => <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9.5l4 4 8-9" {...trazo} strokeWidth="2" /></svg>,
  inicio: () => <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 8l6-5 6 5v7H3z" {...trazo} /><path d="M7.5 15v-4h3v4" {...trazo} /></svg>,
  juegos: () => <svg viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx="1.5" {...trazo} /><rect x="10" y="2" width="6" height="6" rx="1.5" {...trazo} /><rect x="2" y="10" width="6" height="6" rx="1.5" {...trazo} /><rect x="10" y="10" width="6" height="6" rx="1.5" {...trazo} /></svg>,
  herramientas: () => <svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="10" r="6" {...trazo} /><path d="M9 7v3l2 2M7 2h4" {...trazo} /></svg>,
  clases: () => <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 6l7-3.5L16 6l-7 3.5z" {...trazo} /><path d="M5 7.6v3.9c1 1.2 2.4 1.8 4 1.8s3-.6 4-1.8V7.6M16 6v4.5" {...trazo} /></svg>,
  stats: () => <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 15V9M8 15V4M13 15v-4" {...trazo} strokeWidth="1.8" /></svg>,
  preguntas: () => <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 3h9l3 3v9H3z" {...trazo} /><path d="M6 8h6M6 11h6" {...trazo} /></svg>,
  codigo: () => <svg viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="4" width="14" height="10" rx="2" {...trazo} /><path d="M5 9h1M8.5 9h1M12 9h1" {...trazo} strokeWidth="2" /></svg>,
  info: () => <svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6.5" {...trazo} /><path d="M9 8v4M9 5.5v.01" {...trazo} strokeWidth="1.8" /></svg>,
  salir: () => <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M7 3H3v12h4M11 6l3 3-3 3M14 9H7" {...trazo} /></svg>,
  sol: () => <svg viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3.2" {...trazo} /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" {...trazo} /></svg>,
  luna: () => <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M14.5 11A6 6 0 0 1 7 3.5a6 6 0 1 0 7.5 7.5z" {...trazo} /></svg>,
  // Juegos y herramientas
  ludo: () => <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.4" fill="currentColor" /><rect x="11" y="11" width="6" height="6" rx="1.4" fill="currentColor" /><rect x="11" y="3" width="6" height="6" rx="1.4" {...trazo} /><rect x="3" y="11" width="6" height="6" rx="1.4" {...trazo} /></svg>,
  crucigrama: () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6.5h14M3 10h14M3 13.5h14M6.5 3v14M13.5 3v14" {...trazo} /></svg>,
  palabra: () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11.5 2L5 11h5l-1.5 7L15 9h-5z" {...trazo} /></svg>,
  evaluacion: () => <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" {...trazo} /><path d="M7 10.2l2 2 4-4.4" {...trazo} /></svg>,
  estudio: () => <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="10" rx="2" {...trazo} /><path d="M7 17h6M10 14v3" {...trazo} /></svg>,
  cronometro: () => <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="11" r="6.5" {...trazo} /><path d="M10 8v3l2.2 2M8 2.5h4" {...trazo} /></svg>,
  ruleta: () => <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" {...trazo} /><path d="M10 3v7l6 3.5M10 10l-6 3.5" {...trazo} /></svg>,
  pizarra: () => <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="10.5" rx="2" {...trazo} /><path d="M6 17h8M5.5 10.5l3-3 2 2 4-4" {...trazo} /></svg>,
};

export function Marca({ onClick, label = "YachayPlay, inicio" }) {
  const contenido = (
    <>
      <Icono.marca />
      <span>yachay<b>play</b></span>
    </>
  );
  return onClick ? (
    <button type="button" className="cp-brand" onClick={onClick} aria-label={label}>{contenido}</button>
  ) : (
    <span className="cp-brand">{contenido}</span>
  );
}

// Tema claro/oscuro: theme-init.js lo decide antes de pintar; aquí se alterna y se recuerda.
export function useTema() {
  const [tema, setTema] = useState(() => document.documentElement.dataset.theme || "light");
  const alternar = () => {
    const nuevo = (document.documentElement.dataset.theme || tema) === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nuevo;
    try {
      localStorage.setItem("yp_theme", nuevo);
    } catch {
      /* modo privado: el tema no se recuerda */
    }
    setTema(nuevo);
  };
  return [tema, alternar];
}

export function BotonTema({ className = "cp-theme" }) {
  const [tema, alternar] = useTema();
  const oscuro = tema === "dark";
  const texto = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button type="button" className={className} onClick={alternar} aria-label={texto} title={texto}>
      {oscuro ? <Icono.sol /> : <Icono.luna />}
    </button>
  );
}
