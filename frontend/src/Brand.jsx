import React from "react";

// Marca de YachayPlay para la barra superior (fondo azul marino).
// - variant="white": "Yachay" en blanco (para fondos oscuros, el caso normal).
// - variant="color": logo a todo color (para fondos claros).
// Los archivos viven en frontend/public/ y se sirven desde la raíz.
export function Brand({ subtitle, variant = "white", onClick }) {
  const src = "/logo-aula.png";
  return (
    <div
      className={"ref-brand" + (onClick ? " ref-brand-link" : "")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <img className="brand-logo" src={src} alt="YachayPlay" />
      {subtitle && <p className="brand-subtitle">{subtitle}</p>}
    </div>
  );
}
