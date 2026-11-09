import { CONFIG } from "./config";

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const fondoDe = (id) => CONFIG.fondos.find((f) => f.id === id) || CONFIG.fondos[0];

export const colorReal = (c, oscuro) => (c === "auto" ? (oscuro ? "#FFFFFF" : "#111827") : c);

export const fuenteTexto = (s) => `700 ${s}px ${CONFIG.fuente}`;

// ---------------- Exportar (PNG / JPG / PDF) ----------------
export const hoy = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Quita lo que los sistemas no permiten en un nombre de archivo
export const nombreSeguro = (n) =>
  String(n || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80) || "Pizarra";

export function medidaForma(t) {
  const dx = t.x2 - t.x1;
  const dy = t.y2 - t.y1;
  if (t.type === "line" || t.type === "arrow") {
    let ang = Math.round((-Math.atan2(dy, dx) * 180) / Math.PI);
    if (ang < 0) ang += 360;
    return `${Math.round(Math.hypot(dx, dy))} px · ${ang}°`;
  }
  return `${Math.round(Math.abs(dx))} × ${Math.round(Math.abs(dy))} px`;
}
