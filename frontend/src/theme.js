// Mantiene el color de la barra del navegador (meta theme-color) igual al tema de la app.
// Se activa solo: observa el atributo data-theme del <html>, que cambian los botones
// "Modo oscuro / Modo claro" de cada pantalla. No hace falta llamarlo desde ningún lado.
const COLORES = { light: "#f8fffd", dark: "#08232c" };

function aplicar() {
  const tema = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = COLORES[tema];
}

aplicar();
new MutationObserver(aplicar).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
