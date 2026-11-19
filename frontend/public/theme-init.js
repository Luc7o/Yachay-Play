// Se carga en <head> SIN defer a propósito: decide el tema antes del primer pintado.
// Va en un archivo aparte (no inline) para que la Content-Security-Policy no tenga que permitir scripts inline.
// Tema claro/oscuro: se decide antes de pintar para que no parpadee.
try {
  var t = localStorage.getItem("yp_theme");
  if (!t) t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", t === "dark" ? "#0e0f12" : "#f8fffd");
} catch (e) {}
