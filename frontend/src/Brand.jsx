import React from "react";
import { Icono } from "./campusUi";

// Marca de YachayPlay para la barra superior de las pantallas de juego y herramientas
// (diseño "Campus": el logo geométrico + la palabra, sin imagen; sigue el tema claro/oscuro).
export function Brand({ subtitle, onClick }) {
  const contenido = (
    <>
      <span className="cp-brand cp-brand-sm">
        <Icono.marca />
        <span>
          yachay<b>play</b>
        </span>
      </span>
      {subtitle && <p className="brand-subtitle">{subtitle}</p>}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="ref-brand ref-brand-link cp-brand-btn"
      onClick={onClick}
      aria-label="Volver al inicio de YachayPlay"
    >
      {contenido}
    </button>
  ) : (
    <div className="ref-brand">{contenido}</div>
  );
}
