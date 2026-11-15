import React from "react";

// Marca de YachayPlay para la barra superior de las pantallas de juego y herramientas.
// Muestra el logo a todo color en modo claro y la versión clara en modo oscuro
// (las clases sh-logo-light / sh-logo-dark las alterna shell.css según el tema).
// Los archivos viven en frontend/public/ y se sirven desde la raíz.
export function Brand({ subtitle, onClick }) {
  return (
    <div
      className={"ref-brand" + (onClick ? " ref-brand-link" : "")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <img className="brand-logo sh-logo-light" src="/logo-aula.png" alt="YachayPlay" />
      <img className="brand-logo sh-logo-dark" src="/logo-aula-dark.png" alt="" aria-hidden="true" />
      {subtitle && <p className="brand-subtitle">{subtitle}</p>}
    </div>
  );
}
