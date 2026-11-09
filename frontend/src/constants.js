export const COLORS = {
  rojo: { name: "Rojo", hex: "#ef4444", soft: "#fee2e2" },
  verde: { name: "Verde", hex: "#10b981", soft: "#d1fae5" },
  amarillo: { name: "Amarillo", hex: "#eab308", soft: "#fef3c7" },
  azul: { name: "Azul", hex: "#3b82f6", soft: "#dbeafe" },
};

export const TURN_ORDER = ["rojo", "verde", "amarillo", "azul"];

// Marca de versión visible en la pantalla de inicio (footer). Sirve para
// confirmar de un vistazo si el navegador está sirviendo esta versión o una
// vieja en caché.
export const BUILD_VERSION = "2026-09-24-1";

// Duración total de la fase actual del turno (para dibujar las barras de tiempo).
// Los valores fijos (2 s y 6 s) coinciden con ROLLING_SECONDS y RESULT_SECONDS del servidor.
export const phaseTotal = (state) =>
  ({ roll: state.rollSeconds, rolling: 2, question: state.answerTimeLimit, result: 6 })[state.turnPhase] || 20;
