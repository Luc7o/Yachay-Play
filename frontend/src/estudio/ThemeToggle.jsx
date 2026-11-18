import React, { useEffect, useState } from "react";

// Botón pequeño para cambiar entre modo claro y oscuro (icono de sol / luna).
// Usa el mismo mecanismo que el resto de YachayPlay: el atributo data-theme del <html>
// y la clave "yp_theme" en localStorage. Se mantiene sincronizado si el tema cambia en otra parte.
const actual = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle() {
  const [tema, setTema] = useState(actual);

  useEffect(() => {
    const o = new MutationObserver(() => setTema(actual()));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => o.disconnect();
  }, []);

  const oscuro = tema === "dark";
  const cambiar = () => {
    const next = oscuro ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("yp_theme", next); } catch { /* navegación privada */ }
  };
  const texto = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button type="button" className="es-theme" onClick={cambiar} aria-label={texto} title={texto}>
      {oscuro ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
