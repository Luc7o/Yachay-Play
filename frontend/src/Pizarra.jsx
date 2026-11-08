import React, { useEffect, useRef, useState } from "react";
import { Brand } from "./Brand";
import "./herramientas.css";
import "./pizarra.css";

// ============================================================================
// PIZARRA PARA EL DOCENTE
// ============================================================================
// Una pizarra para escribir, dibujar y explicar en clase. Todo ocurre en el
// navegador (sin cuenta y sin servidor); lo que se dibuja se guarda solo en
// este equipo y sigue ahí al volver.
//
// Cada trazo, forma o texto es un "objeto" (no un dibujo plano). Por eso se
// puede deshacer, rehacer, mover y borrar cada cosa por separado.
// El borrador funciona como el de Paint: solo quita lo que pasas por encima.
//
// Lo más fácil de personalizar está en CONFIG (colores, grosores, fondos).
//
// NOVEDADES: nombre del trabajo, cuadro "Guardar" (nombre, PNG / JPG / PDF,
// una página o todas), indicador de lo que se está haciendo en vivo, vista
// previa del pincel, medidas al dibujar formas y aviso de guardado.
// ============================================================================

const CONFIG = {
  clave: "yachayplay.pizarra.v1", // dónde se guarda en este navegador
  // "auto" = negro sobre fondo claro y blanco sobre fondo oscuro
  colores: ["auto", "#E53935", "#F16503", "#FBC02D", "#2E9E5B", "#1E6FD9", "#7E57C2", "#E91E8C"],
  // trazo (px), tamaño del texto (px) y radio del borrador (px) para Fino / Medio / Grueso
  grosores: [
    { nombre: "Fino", w: 2.5, t: 24, b: 12 },
    { nombre: "Medio", w: 5, t: 40, b: 22 },
    { nombre: "Grueso", w: 10, t: 64, b: 40 },
  ],
  fondos: [
    { id: "blanco", nombre: "Blanco", color: "#FFFFFF", oscuro: false },
    { id: "cuadro", nombre: "Cuadriculado", color: "#FFFFFF", oscuro: false },
    { id: "rayas", nombre: "Rayado", color: "#FFFFFF", oscuro: false },
    { id: "plano", nombre: "Plano cartesiano", color: "#FFFFFF", oscuro: false },
    { id: "verde", nombre: "Pizarra verde", color: "#1F4D3A", oscuro: true },
    { id: "oscuro", nombre: "Pizarra negra", color: "#000000", oscuro: true },
  ],
  fuente: '"Poppins","Nunito",system-ui,sans-serif',
  maxHistorial: 100,
};

const TAU = Math.PI * 2;
const FORMAS = [
  { id: "line", nombre: "Línea" },
  { id: "arrow", nombre: "Flecha" },
  { id: "rect", nombre: "Rectángulo" },
  { id: "ellipse", nombre: "Óvalo" },
  { id: "tri", nombre: "Triángulo" },
];
const ES_FORMA = new Set(["line", "arrow", "rect", "ellipse", "tri"]);
const CON_RELLENO = new Set(["rect", "ellipse", "tri"]);

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const fondoDe = (id) => CONFIG.fondos.find((f) => f.id === id) || CONFIG.fondos[0];
const colorReal = (c, oscuro) => (c === "auto" ? (oscuro ? "#FFFFFF" : "#111827") : c);
const fuenteTexto = (s) => `700 ${s}px ${CONFIG.fuente}`;

// ---------------- Íconos (SVG simples) ----------------
const ICONOS = {
  mover: <path d="M4 3l7.07 16.97 2.51-7.39 7.39-2.51L4 3z" />,
  lapiz: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
  marcador: (
    <>
      <path d="M9 11l-6 6v3h9l3-3" />
      <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </>
  ),
  borrador: (
    <>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </>
  ),
  texto: <path d="M4 7V4h16v3M9 20h6M12 4v16" />,
  formas: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <circle cx="17.5" cy="6.5" r="3.5" />
      <path d="M6.5 14l4 7h-8z" />
      <path d="M14 21l7-7" />
    </>
  ),
  line: <path d="M5 19L19 5" />,
  arrow: <path d="M5 19L19 5M10 5h9v9" />,
  rect: <rect x="4" y="5" width="16" height="14" rx="1" />,
  ellipse: <ellipse cx="12" cy="12" rx="9" ry="6.5" />,
  tri: <path d="M12 4l9 16H3z" />,
  deshacer: (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),
  rehacer: (
    <>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </>
  ),
  basura: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />,
  descargar: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  pantalla: <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  fondo: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  izq: <path d="M15 6l-6 6 6 6" />,
  der: <path d="M9 6l6 6-6 6" />,
};
function Icono({ n, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONOS[n]}
    </svg>
  );
}

// ---------------- Geometría de los objetos ----------------
let medidor = null;
function medirTexto(o) {
  if (!medidor) medidor = document.createElement("canvas").getContext("2d");
  medidor.font = fuenteTexto(o.size);
  const lineas = o.text.split("\n");
  const w = Math.max(10, ...lineas.map((l) => medidor.measureText(l).width));
  return { w, h: lineas.length * o.size * 1.25, lineas };
}

function cajaDe(o) {
  if (o.type === "text") {
    const m = medirTexto(o);
    return { x: o.x, y: o.y, w: m.w, h: m.h };
  }
  let x1;
  let y1;
  let x2;
  let y2;
  if (o.pts) {
    x1 = Math.min(...o.pts.map((p) => p[0]));
    x2 = Math.max(...o.pts.map((p) => p[0]));
    y1 = Math.min(...o.pts.map((p) => p[1]));
    y2 = Math.max(...o.pts.map((p) => p[1]));
  } else {
    x1 = Math.min(o.x1, o.x2);
    x2 = Math.max(o.x1, o.x2);
    y1 = Math.min(o.y1, o.y2);
    y2 = Math.max(o.y1, o.y2);
  }
  const grosor = o.type === "hl" ? o.w * 3.5 : o.w;
  return { x: x1 - grosor / 2, y: y1 - grosor / 2, w: x2 - x1 + grosor, h: y2 - y1 + grosor };
}

function distSegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function vertices(o) {
  const x1 = Math.min(o.x1, o.x2);
  const x2 = Math.max(o.x1, o.x2);
  const y1 = Math.min(o.y1, o.y2);
  const y2 = Math.max(o.y1, o.y2);
  if (o.type === "tri") return [[(x1 + x2) / 2, y1], [x2, y2], [x1, y2]];
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]; // rect
}

// ¿El punto (x, y) está tocando este objeto? tol = margen en píxeles
function toca(o, x, y, tol) {
  switch (o.type) {
    case "pen":
    case "hl": {
      const r = tol + (o.type === "hl" ? o.w * 1.75 : o.w / 2);
      if (o.pts.length === 1) return Math.hypot(x - o.pts[0][0], y - o.pts[0][1]) <= r;
      for (let i = 1; i < o.pts.length; i++) {
        if (distSegmento(x, y, o.pts[i - 1][0], o.pts[i - 1][1], o.pts[i][0], o.pts[i][1]) <= r) return true;
      }
      return false;
    }
    case "line":
    case "arrow":
      return distSegmento(x, y, o.x1, o.y1, o.x2, o.y2) <= tol + o.w / 2 + 2;
    case "rect":
    case "tri": {
      const b = cajaDe({ ...o, w: 0 });
      if (o.fill && x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol) return true;
      const v = vertices(o);
      for (let i = 0; i < v.length; i++) {
        const a = v[i];
        const c = v[(i + 1) % v.length];
        if (distSegmento(x, y, a[0], a[1], c[0], c[1]) <= tol + o.w / 2 + 2) return true;
      }
      return false;
    }
    case "ellipse": {
      const cx = (o.x1 + o.x2) / 2;
      const cy = (o.y1 + o.y2) / 2;
      const rx = Math.max(1, Math.abs(o.x2 - o.x1) / 2);
      const ry = Math.max(1, Math.abs(o.y2 - o.y1) / 2);
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const m = Math.min(rx, ry);
      return o.fill ? d <= 1 + tol / m : Math.abs(d - 1) * m <= tol + o.w / 2 + 2;
    }
    case "text": {
      const b = cajaDe(o);
      return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
    }
    default:
      return false;
  }
}

function mover(o, dx, dy) {
  if (o.pts) return { ...o, pts: o.pts.map((p) => [p[0] + dx, p[1] + dy]) };
  if (o.type === "text") return { ...o, x: o.x + dx, y: o.y + dy };
  return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
}

// Con Shift: línea en ángulos de 45°, y cuadrado / círculo perfecto
function restringir(tipo, x1, y1, x, y) {
  const dx = x - x1;
  const dy = y - y1;
  if (tipo === "line" || tipo === "arrow") {
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const l = Math.hypot(dx, dy);
    return [x1 + Math.cos(ang) * l, y1 + Math.sin(ang) * l];
  }
  const l = Math.max(Math.abs(dx), Math.abs(dy));
  return [x1 + Math.sign(dx || 1) * l, y1 + Math.sign(dy || 1) * l];
}

// ---------------- Dibujo ----------------
function trazar(ctx, o, oscuro) {
  const col = colorReal(o.color, oscuro);
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = o.w;
  switch (o.type) {
    case "pen":
    case "hl":
    case "erase": {
      if (o.type === "erase") ctx.globalCompositeOperation = "destination-out"; // quita lo que ya estaba pintado
      if (o.type === "hl") {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = o.w * 3.5;
      }
      const p = o.pts;
      if (p.length === 1) {
        ctx.beginPath();
        ctx.arc(p[0][0], p[0][1], ctx.lineWidth / 2, 0, TAU);
        ctx.fill();
        break;
      }
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) {
        ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
      }
      ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
      break;
    }
    case "line":
    case "arrow": {
      ctx.beginPath();
      ctx.moveTo(o.x1, o.y1);
      ctx.lineTo(o.x2, o.y2);
      ctx.stroke();
      if (o.type === "arrow") {
        const ang = Math.atan2(o.y2 - o.y1, o.x2 - o.x1);
        const l = 12 + o.w * 2.4;
        ctx.beginPath();
        ctx.moveTo(o.x2 - l * Math.cos(ang - 0.5), o.y2 - l * Math.sin(ang - 0.5));
        ctx.lineTo(o.x2, o.y2);
        ctx.lineTo(o.x2 - l * Math.cos(ang + 0.5), o.y2 - l * Math.sin(ang + 0.5));
        ctx.stroke();
      }
      break;
    }
    case "rect":
    case "tri":
    case "ellipse": {
      ctx.beginPath();
      if (o.type === "ellipse") {
        ctx.ellipse((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, Math.max(1, Math.abs(o.x2 - o.x1) / 2), Math.max(1, Math.abs(o.y2 - o.y1) / 2), 0, 0, TAU);
      } else {
        const v = vertices(o);
        ctx.moveTo(v[0][0], v[0][1]);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i][0], v[i][1]);
        ctx.closePath();
      }
      if (o.fill) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
      break;
    }
    case "text": {
      ctx.font = fuenteTexto(o.size);
      ctx.textBaseline = "middle";
      const lh = o.size * 1.25;
      o.text.split("\n").forEach((l, i) => ctx.fillText(l, o.x, o.y + i * lh + lh / 2));
      break;
    }
    default:
  }
  ctx.restore();
}

function pintarFondo(ctx, W, H, idFondo) {
  const f = fondoDe(idFondo);
  ctx.save();
  ctx.fillStyle = f.color;
  ctx.fillRect(0, 0, W, H);
  const g = 40;
  const linea = (x1, y1, x2, y2) => {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  };
  if (f.id === "cuadro" || f.id === "plano") {
    ctx.strokeStyle = f.id === "plano" ? "#E3ECF6" : "#D6E2F0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += g) linea(x + 0.5, 0, x + 0.5, H);
    for (let y = 0; y <= H; y += g) linea(0, y + 0.5, W, y + 0.5);
    ctx.stroke();
  }
  if (f.id === "rayas") {
    ctx.strokeStyle = "#D6E2F0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 56; y <= H; y += 44) linea(0, y + 0.5, W, y + 0.5);
    ctx.stroke();
    ctx.strokeStyle = "#F3B8B8";
    ctx.beginPath();
    linea(96.5, 0, 96.5, H);
    ctx.stroke();
  }
  if (f.id === "plano") {
    const cx = Math.round(W / 2 / g) * g;
    const cy = Math.round(H / 2 / g) * g;
    ctx.strokeStyle = "#334155";
    ctx.fillStyle = "#64748B";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    linea(0, cy, W, cy);
    linea(cx, 0, cx, H);
    ctx.stroke();
    // puntas de flecha en los extremos de los ejes
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(W - 2, cy);
    ctx.lineTo(W - 14, cy - 5);
    ctx.lineTo(W - 14, cy + 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(cx - 5, 14);
    ctx.lineTo(cx + 5, 14);
    ctx.fill();
    // números en cada unidad
    ctx.font = `600 11px ${CONFIG.fuente}`;
    ctx.fillStyle = "#64748B";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let x = cx % g; x <= W - 20; x += g) {
      const n = Math.round((x - cx) / g);
      if (n !== 0 && x > 8) ctx.fillText(String(n), x, cy + 5);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = cy % g; y <= H - 8; y += g) {
      const n = Math.round((cy - y) / g);
      if (n !== 0 && y > 20) ctx.fillText(String(n), cx - 6, y);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("0", cx - 6, cy + 5);
    ctx.font = `700 13px ${CONFIG.fuente}`;
    ctx.fillStyle = "#334155";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("x", W - 14, cy - 10);
    ctx.fillText("y", cx + 10, 18);
  }
  ctx.restore();
}

let capa = null; // lienzo auxiliar: aquí se dibujan los trazos para poder borrarlos sin tocar el fondo
function dibujarEscena(ctx, W, H, pagina, ocultos, extra) {
  const oscuro = fondoDe(pagina.fondo).oscuro;
  pintarFondo(ctx, W, H, pagina.fondo);
  const hayBorrado = pagina.objs.some((o) => o.type === "erase") || (extra && extra.type === "erase");
  if (!hayBorrado) {
    for (const o of pagina.objs) {
      if (!ocultos || !ocultos.has(o.id)) trazar(ctx, o, oscuro);
    }
    if (extra) trazar(ctx, extra, oscuro);
    return;
  }
  if (!capa) capa = document.createElement("canvas");
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  if (capa.width !== cw || capa.height !== ch) {
    capa.width = cw;
    capa.height = ch;
  }
  const lc = capa.getContext("2d");
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, cw, ch);
  lc.setTransform(ctx.getTransform());
  for (const o of pagina.objs) {
    if (!ocultos || !ocultos.has(o.id)) trazar(lc, o, oscuro);
  }
  if (extra) trazar(lc, extra, oscuro);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(capa, 0, 0);
  ctx.restore();
}

// ---------------- Guardado ----------------
function paginaNueva(fondo = "blanco") {
  return { id: uid(), fondo, objs: [] };
}
function cargar() {
  const base = { paginas: [paginaNueva()], actual: 0, color: "auto", grosor: 1, nombre: "" };
  try {
    const d = JSON.parse(localStorage.getItem(CONFIG.clave) || "null");
    if (!d || !Array.isArray(d.paginas) || !d.paginas.length) return base;
    const paginas = d.paginas
      .filter((p) => p && Array.isArray(p.objs))
      .map((p) => {
        const f = fondoDe(p.fondo);
        // los trazos "auto" de versiones anteriores se fijan al color que se veía en esa página
        return { id: p.id || uid(), fondo: f.id, objs: p.objs.map((o) => (o && o.color === "auto" ? { ...o, color: colorReal("auto", f.oscuro) } : o)) };
      });
    if (!paginas.length) return base;
    return {
      paginas,
      actual: Math.min(Math.max(0, d.actual | 0), paginas.length - 1),
      color: typeof d.color === "string" ? d.color : "auto",
      grosor: [0, 1, 2].includes(d.grosor) ? d.grosor : 1,
      nombre: typeof d.nombre === "string" ? d.nombre.slice(0, 80) : "",
    };
  } catch {
    return base;
  }
}


// ---------------- Textos de ayuda y medidas en vivo ----------------
const NOMBRES_HERR = { mover: "Seleccionar", lapiz: "Lápiz", marcador: "Marcador", borrador: "Borrador", texto: "Texto", forma: "Forma" };
const NOMBRES_OBJ = { pen: "Trazo", hl: "Resaltado", line: "Línea", arrow: "Flecha", rect: "Rectángulo", ellipse: "Óvalo", tri: "Triángulo", text: "Texto" };
const AYUDA = {
  mover: "Toca un dibujo para seleccionarlo y arrástralo",
  lapiz: "Mantén presionado y dibuja",
  marcador: "Pasa sobre lo que quieras resaltar",
  borrador: "Mantén presionado y pasa por lo que quieras borrar",
  texto: "Haz clic donde quieras escribir",
  forma: "Arrastra para dibujar · Shift = proporcional",
};
function medidaForma(t) {
  const dx = t.x2 - t.x1;
  const dy = t.y2 - t.y1;
  if (t.type === "line" || t.type === "arrow") {
    let ang = Math.round((-Math.atan2(dy, dx) * 180) / Math.PI);
    if (ang < 0) ang += 360;
    return `${Math.round(Math.hypot(dx, dy))} px · ${ang}°`;
  }
  return `${Math.round(Math.abs(dx))} × ${Math.round(Math.abs(dy))} px`;
}

// ---------------- Exportar (PNG / JPG / PDF) ----------------
const hoy = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
// Quita lo que los sistemas no permiten en un nombre de archivo
const nombreSeguro = (n) =>
  String(n || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80) || "Pizarra";

function renderPagina(p, W, H, esc = 2) {
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(W * esc));
  off.height = Math.max(1, Math.round(H * esc));
  const ctx = off.getContext("2d");
  ctx.scale(esc, esc);
  dibujarEscena(ctx, W, H, p, null, null);
  return off;
}
const aBlob = (cv, tipo, calidad) => new Promise((ok) => cv.toBlob(ok, tipo, calidad));
function bajar(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// PDF mínimo hecho a mano: una imagen JPEG por página (sin librerías externas)
function crearPDF(imgs, pw, ph, titulo) {
  const enc = new TextEncoder();
  const partes = [];
  const offs = [];
  let largo = 0;
  const push = (d) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    partes.push(b);
    largo += b.length;
  };
  const n = imgs.length;
  const num = (v) => (Math.round(v * 100) / 100).toString();
  const hexTitulo = "FEFF" + Array.from(String(titulo || "")).map((ch) => ch.codePointAt(0)).flatMap((cp) => {
    if (cp > 0xffff) { const c = cp - 0x10000; return [0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff)]; }
    return [cp];
  }).map((u) => u.toString(16).padStart(4, "0")).join("").toUpperCase();

  push("%PDF-1.4\n");
  offs[1] = largo;
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offs[2] = largo;
  push(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${imgs.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>\nendobj\n`);
  imgs.forEach((im, i) => {
    const pg = 3 + i * 3;
    const ct = pg + 1;
    const ig = pg + 2;
    offs[pg] = largo;
    push(`${pg} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pw)} ${num(ph)}] /Resources << /XObject << /Im0 ${ig} 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
    const cont = `q ${num(pw)} 0 0 ${num(ph)} 0 0 cm /Im0 Do Q`;
    offs[ct] = largo;
    push(`${ct} 0 obj\n<< /Length ${cont.length} >>\nstream\n${cont}\nendstream\nendobj\n`);
    offs[ig] = largo;
    push(`${ig} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
    push(im.bytes);
    push("\nendstream\nendobj\n");
  });
  const info = 3 + n * 3;
  offs[info] = largo;
  push(`${info} 0 obj\n<< /Title <${hexTitulo}> /Producer (YachayPlay Pizarra) >>\nendobj\n`);
  const xref = largo;
  push(`xref\n0 ${info + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= info; i++) push(`${String(offs[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${info + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(partes, { type: "application/pdf" });
}

// Cuadro "Guardar tu trabajo": nombre, formato y páginas
function DialogoDescarga({ vista, nombreInicial, paginas, ocupado, onCancelar, onConfirmar }) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [formato, setFormato] = useState("png");
  const [alcance, setAlcance] = useState(paginas > 1 ? "todas" : "actual");
  const [fecha, setFecha] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);
  const esPdf = formato === "pdf";
  const alc = esPdf ? alcance : "actual";
  const archivo = nombreSeguro(nombre + (fecha ? ` ${hoy()}` : ""));
  const enviar = (e) => {
    e.preventDefault();
    if (!ocupado) onConfirmar({ nombre, archivo, formato, alcance: alc });
  };
  const FORMATOS = [
    ["png", "PNG", "Imagen nítida"],
    ["jpg", "JPG", "Más liviana"],
    ["pdf", "PDF", "Para imprimir o enviar"],
  ];
  return (
    <div
      className="pz-modal-fondo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancelar(); } }}
    >
      <form className="pz-modal" role="dialog" aria-modal="true" aria-labelledby="pz-dl-t" onSubmit={enviar}>
        <h2 id="pz-dl-t">Guardar tu trabajo</h2>
        <div className="pz-vista"><img src={vista} alt="Vista previa de la página actual" /></div>

        <label className="pz-lab" htmlFor="pz-dl-nombre">Nombre del trabajo</label>
        <input id="pz-dl-nombre" ref={inputRef} type="text" value={nombre} maxLength={80} placeholder="Ej.: Clase de fracciones" onChange={(e) => setNombre(e.target.value)} />
        <label className="pz-check">
          <input type="checkbox" checked={fecha} onChange={(e) => setFecha(e.target.checked)} /> Agregar la fecha al nombre
        </label>

        <div className="pz-lab">Formato</div>
        <div className="pz-chips" role="group" aria-label="Formato">
          {FORMATOS.map(([id, t, sub]) => (
            <button key={id} type="button" className="pz-chip" aria-pressed={formato === id} onClick={() => setFormato(id)}>
              <b>{t}</b><small>{sub}</small>
            </button>
          ))}
        </div>

        {esPdf && paginas > 1 && (
          <>
            <div className="pz-lab">Páginas</div>
            <div className="pz-chips pz-chips-2" role="group" aria-label="Páginas">
              <button type="button" className="pz-chip" aria-pressed={alcance === "actual"} onClick={() => setAlcance("actual")}><b>Solo esta</b></button>
              <button type="button" className="pz-chip" aria-pressed={alcance === "todas"} onClick={() => setAlcance("todas")}><b>Todas ({paginas})</b></button>
            </div>
          </>
        )}

        <p className="pz-archivo">Se guardará como <b>{archivo}.{formato}</b></p>
        <div className="pz-acciones">
          <button type="button" className="hr-btn" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="hr-btn hr-primary" disabled={ocupado}>{ocupado ? "Guardando…" : "Descargar"}</button>
        </div>
      </form>
    </div>
  );
}

// Miniatura de cada fondo para la lista (así se ve cómo es antes de elegirlo)
function muestraFondo(f) {
  const l = "#C3D3E6";
  if (f.id === "cuadro") return { backgroundColor: f.color, backgroundImage: `linear-gradient(${l} 1px,transparent 1px),linear-gradient(90deg,${l} 1px,transparent 1px)` };
  if (f.id === "rayas") return { backgroundColor: f.color, backgroundImage: `linear-gradient(${l} 1px,transparent 1px)` };
  if (f.id === "plano") return { backgroundColor: f.color, backgroundImage: `linear-gradient(#334155 0 0),linear-gradient(#334155 0 0),linear-gradient(${l} 1px,transparent 1px),linear-gradient(90deg,${l} 1px,transparent 1px)`, backgroundSize: "100% 2px,2px 100%,8px 8px,8px 8px", backgroundPosition: "0 50%,50% 0,0 0,0 0", backgroundRepeat: "no-repeat,no-repeat,repeat,repeat" };
  return { backgroundColor: f.color };
}

// Botón cuadrado de la barra (fuera del componente para que no se recree en cada cambio)
function Btn({ n, titulo, activo, onClick, disabled }) {
  return (
    <button className="pz-btn" title={titulo} aria-label={titulo} aria-pressed={activo === undefined ? undefined : activo} disabled={disabled} onClick={onClick}>
      <Icono n={n} />
    </button>
  );
}

// ============================================================================
export function Pizarra({ goHome }) {
  const inicial = useRef(null);
  if (!inicial.current) inicial.current = cargar();

  const [paginas, setPaginas] = useState(inicial.current.paginas);
  const [actual, setActual] = useState(inicial.current.actual);
  const [herr, setHerr] = useState("lapiz"); // mover | lapiz | marcador | borrador | texto | forma
  const [forma, setForma] = useState("rect");
  const [color, setColor] = useState(inicial.current.color);
  const [grosor, setGrosor] = useState(inicial.current.grosor);
  const [relleno, setRelleno] = useState(false);
  const [seleccion, setSeleccion] = useState(null);
  const [texto, setTexto] = useState(null); // editor de texto abierto: { id, x, y, value, color, size }
  const [menu, setMenu] = useState(null); // "formas" | "fondo" | null
  const [enfoque, setEnfoque] = useState(false); // true = sin barra superior (para proyectar)
  const [nombre, setNombre] = useState(inicial.current.nombre); // nombre del trabajo
  const [dialogo, setDialogo] = useState(null); // cuadro "Guardar" abierto: { vista }
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState(""); // mensaje corto que aparece y se va solo
  const [guardado, setGuardado] = useState("ok"); // ok | pendiente | error
  const [vivo, setVivo] = useState(""); // lo que se está haciendo ahora mismo

  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const taRef = useRef(null);
  const rafRef = useRef(0);
  const histRef = useRef({}); // id de página -> { undo: [], redo: [] }
  const paginasRef = useRef(paginas);
  const actualRef = useRef(actual);
  const seleccionRef = useRef(seleccion);
  const textoRef = useRef(texto);
  const herrRef = useRef(herr);
  const tempRef = useRef(null); // objeto que se está dibujando ahora mismo
  const ocultosRef = useRef(new Set()); // objetos que no se pintan (borrados sin soltar, o moviéndose)
  const hoverRef = useRef(null);
  const gestoRef = useRef(null); // gesto en curso del puntero
  const usoPantallaCompleta = useRef(false);
  const avisoRef = useRef(0);
  const dialogoRef = useRef(null);
  const colorRef = useRef(color);

  paginasRef.current = paginas;
  actualRef.current = actual;
  seleccionRef.current = seleccion;
  textoRef.current = texto;
  herrRef.current = herr;
  dialogoRef.current = dialogo;
  colorRef.current = color;

  const idx = Math.min(actual, paginas.length - 1);
  const pagina = paginas[idx];
  const oscuro = fondoDe(pagina.fondo).oscuro;
  const g = CONFIG.grosores[grosor];
  const objSel = seleccion ? pagina.objs.find((o) => o.id === seleccion) : null;

  const pag = () => paginasRef.current[Math.min(actualRef.current, paginasRef.current.length - 1)];
  const histDe = (id) => (histRef.current[id] = histRef.current[id] || { undo: [], redo: [] });

  // ---------------- Historial (deshacer / rehacer) ----------------
  function poner(objs) {
    const id = pag().id;
    const nuevas = paginasRef.current.map((p) => (p.id === id ? { ...p, objs } : p));
    paginasRef.current = nuevas;
    setPaginas(nuevas);
  }
  function aplicar(objs) {
    const p = pag();
    const h = histDe(p.id);
    h.undo.push(p.objs);
    if (h.undo.length > CONFIG.maxHistorial) h.undo.shift();
    h.redo = [];
    poner(objs);
  }
  function deshacer() {
    const p = pag();
    const h = histDe(p.id);
    if (!h.undo.length) return;
    h.redo.push(p.objs);
    poner(h.undo.pop());
    setSeleccion(null);
  }
  function rehacer() {
    const p = pag();
    const h = histDe(p.id);
    if (!h.redo.length) return;
    h.undo.push(p.objs);
    poner(h.redo.pop());
    setSeleccion(null);
  }
  const hp = histDe(pagina.id);

  // ---------------- Pintar ----------------
  function dibujar() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth;
    const H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const p = pag();
    const edit = textoRef.current && textoRef.current.id;
    const ocultos = new Set(ocultosRef.current);
    if (edit) ocultos.add(edit);
    dibujarEscena(ctx, W, H, p, ocultos, tempRef.current && tempRef.current.type !== "mover" ? tempRef.current : null);

    // caja de selección
    const sel = p.objs.find((o) => o.id === seleccionRef.current);
    if (sel && herrRef.current === "mover") {
      const mostrado = gestoRef.current && gestoRef.current.tipo === "mover" && tempRef.current ? tempRef.current : sel;
      const b = cajaDe(mostrado);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#F16503";
      ctx.lineWidth = 1.6;
      ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
      ctx.restore();
    }
    // círculo del borrador
    if (herrRef.current === "borrador" && hoverRef.current) {
      const r = CONFIG.grosores[grosorRef.current].b;
      ctx.save();
      ctx.beginPath();
      ctx.arc(hoverRef.current.x, hoverRef.current.y, r, 0, TAU);
      ctx.fillStyle = fondoDe(p.fondo).oscuro ? "rgba(255,255,255,.12)" : "rgba(127,127,127,.18)";
      ctx.fill();
      ctx.strokeStyle = fondoDe(p.fondo).oscuro ? "rgba(255,255,255,.9)" : "rgba(100,116,139,.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    // vista previa del pincel: muestra el color y el grosor antes de dibujar
    const gs = gestoRef.current;
    const hv = hoverRef.current;
    if ((herrRef.current === "lapiz" || herrRef.current === "marcador") && hv && !gs) {
      const gr = CONFIG.grosores[grosorRef.current];
      const marc = herrRef.current === "marcador";
      const r = Math.max(3, (marc ? gr.w * 3.5 : gr.w) / 2);
      const osc = fondoDe(p.fondo).oscuro;
      ctx.save();
      ctx.beginPath();
      ctx.arc(hv.x, hv.y, r, 0, TAU);
      ctx.globalAlpha = marc ? 0.35 : 0.9;
      ctx.fillStyle = colorReal(colorRef.current, osc);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = osc ? "rgba(255,255,255,.85)" : "rgba(15,23,42,.65)";
      ctx.stroke();
      ctx.restore();
    }
    // medidas de la forma mientras se dibuja
    if (gs && gs.tipo === "forma" && tempRef.current) {
      const t = tempRef.current;
      const txt = medidaForma(t);
      ctx.save();
      ctx.font = `700 12px ${CONFIG.fuente}`;
      const bw = ctx.measureText(txt).width + 16;
      const lx = Math.min(Math.max(8, t.x2 + 14), W - bw - 8);
      const ly = Math.min(Math.max(8, t.y2 + 14), H - 32);
      ctx.fillStyle = "rgba(15,42,74,.92)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx, ly, bw, 22, 7);
      else ctx.rect(lx, ly, bw, 22);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, lx + 8, ly + 11.5);
      ctx.restore();
    }
  }
  const grosorRef = useRef(grosor);
  grosorRef.current = grosor;
  function pedir() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      dibujar();
    });
  }
  useEffect(pedir); // se vuelve a pintar después de cada cambio

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const obs = window.ResizeObserver ? new ResizeObserver(pedir) : null;
    if (obs) obs.observe(el);
    window.addEventListener("resize", pedir);
    return () => {
      if (obs) obs.disconnect();
      window.removeEventListener("resize", pedir);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0; // sin esto, React.StrictMode deja el repintado "bloqueado" y el lienzo nunca se actualiza
    };
  }, []);

  // ---------------- Guardado en este navegador ----------------
  useEffect(() => {
    setGuardado("pendiente");
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CONFIG.clave, JSON.stringify({ paginas, actual: idx, color, grosor, nombre }));
        setGuardado("ok");
      } catch {
        setGuardado("error"); // si el navegador no deja guardar (o se llenó), la pizarra sigue funcionando
      }
    }, 500);
    return () => clearTimeout(t);
  }, [paginas, idx, color, grosor, nombre]);

  // ---------------- Avisos cortos ----------------
  function avisar(msg) {
    setAviso(msg);
    clearTimeout(avisoRef.current);
    avisoRef.current = setTimeout(() => setAviso(""), 3200);
  }
  useEffect(() => () => clearTimeout(avisoRef.current), []);

  // ---------------- Texto ----------------
  function ponerTexto(t) {
    textoRef.current = t;
    setTexto(t);
  }
  function abrirTexto(obj, x, y) {
    if (obj) ponerTexto({ id: obj.id, x: obj.x, y: obj.y, value: obj.text, color: obj.color, size: obj.size });
    else ponerTexto({ id: null, x, y: y - g.t * 0.625, value: "", color: colorReal(color, oscuro), size: g.t });
    setSeleccion(null);
  }
  function confirmarTexto() {
    const t = textoRef.current;
    if (!t) return;
    ponerTexto(null);
    const v = t.value.replace(/\s+$/, "");
    const objs = pag().objs;
    if (t.id) {
      if (!v.trim()) aplicar(objs.filter((o) => o.id !== t.id));
      else if (objs.find((o) => o.id === t.id)?.text !== v) aplicar(objs.map((o) => (o.id === t.id ? { ...o, text: v } : o)));
    } else if (v.trim()) {
      aplicar([...objs, { id: uid(), type: "text", x: t.x, y: t.y, text: v, color: t.color, size: t.size }]);
    }
  }
  useEffect(() => {
    if (texto && taRef.current && document.activeElement !== taRef.current) {
      const t = setTimeout(() => {
        if (taRef.current) {
          taRef.current.focus();
          const n = taRef.current.value.length;
          taRef.current.setSelectionRange(n, n);
        }
      }, 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [texto && texto.x, texto && texto.y, texto && texto.id]);

  // ---------------- Punteros ----------------
  function posicion(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function encima(x, y, tol) {
    const objs = pag().objs;
    for (let i = objs.length - 1; i >= 0; i--) if (toca(objs[i], x, y, tol)) return objs[i];
    return null;
  }
  function alBajar(e) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (document.activeElement && document.activeElement.tagName === "TEXTAREA") document.activeElement.blur(); // confirma el texto abierto
    setMenu(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = posicion(e);
    hoverRef.current = { x, y };
    const col = colorReal(color, oscuro); // el color queda fijo: cambiar el fondo no lo modifica

    if (herr === "lapiz" || herr === "marcador") {
      tempRef.current = { id: uid(), type: herr === "lapiz" ? "pen" : "hl", color: col, w: g.w, pts: [[x, y]] };
      gestoRef.current = { tipo: "trazo" };
      setSeleccion(null);
      setVivo(herr === "lapiz" ? "Dibujando…" : "Resaltando…");
    } else if (herr === "forma") {
      tempRef.current = { id: uid(), type: forma, color: col, w: g.w, x1: x, y1: y, x2: x, y2: y, fill: CON_RELLENO.has(forma) && relleno };
      gestoRef.current = { tipo: "forma" };
      setSeleccion(null);
      setVivo(medidaForma(tempRef.current));
    } else if (herr === "borrador") {
      tempRef.current = { id: uid(), type: "erase", color: "#000000", w: CONFIG.grosores[grosor].b * 2, pts: [[x, y]] };
      gestoRef.current = { tipo: "trazo" };
      setVivo("Borrando…");
    } else if (herr === "mover") {
      const o = encima(x, y, 8);
      setSeleccion(o ? o.id : null);
      gestoRef.current = o ? { tipo: "mover", id: o.id, x0: x, y0: y, orig: o, movido: false } : null;
      setVivo(o ? `${NOMBRES_OBJ[o.type] || "Elemento"} seleccionado` : "");
    } else if (herr === "texto") {
      gestoRef.current = { tipo: "texto", x0: x, y0: y };
    }
    pedir();
  }

  function alMover(e) {
    const { x, y } = posicion(e);
    hoverRef.current = { x, y };
    const gs = gestoRef.current;
    if (gs) {
      if (gs.tipo === "trazo") {
        const evs = e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : [];
        const lista = evs.length ? evs : [e.nativeEvent];
        const r = canvasRef.current.getBoundingClientRect();
        for (const ev of lista) {
          const px = ev.clientX - r.left;
          const py = ev.clientY - r.top;
          const u = tempRef.current.pts[tempRef.current.pts.length - 1];
          if (Math.hypot(px - u[0], py - u[1]) > 1.2) tempRef.current.pts.push([px, py]);
        }
      } else if (gs.tipo === "forma") {
        let [x2, y2] = [x, y];
        if (e.shiftKey) [x2, y2] = restringir(tempRef.current.type, tempRef.current.x1, tempRef.current.y1, x, y);
        tempRef.current = { ...tempRef.current, x2, y2 };
        setVivo(medidaForma(tempRef.current));
      } else if (gs.tipo === "mover") {
        const dx = x - gs.x0;
        const dy = y - gs.y0;
        if (gs.movido || Math.hypot(dx, dy) > 3) {
          gs.movido = true;
          ocultosRef.current = new Set([gs.id]);
          tempRef.current = mover(gs.orig, dx, dy);
          tempRef.current.__mov = true;
          setVivo("Moviendo…");
        }
      } else if (gs.tipo === "texto") {
        if (Math.hypot(x - gs.x0, y - gs.y0) > 6) gs.arrastro = true;
      }
    }
    pedir();
  }

  function alSoltar(e) {
    const gs = gestoRef.current;
    gestoRef.current = null;
    setVivo("");
    if (e.pointerType !== "mouse") hoverRef.current = null; // en táctil no queda el círculo "pegado"
    const { x, y } = posicion(e);
    if (gs) {
      const objs = pag().objs;
      if (gs.tipo === "trazo" && tempRef.current) {
        if (tempRef.current.type !== "erase" || objs.some((o) => o.type !== "erase")) aplicar([...objs, tempRef.current]);
      } else if (gs.tipo === "forma" && tempRef.current) {
        const t = tempRef.current;
        if (Math.hypot(t.x2 - t.x1, t.y2 - t.y1) > 4) aplicar([...objs, t]);
      } else if (gs.tipo === "mover" && gs.movido && tempRef.current) {
        const { __mov, ...movido } = tempRef.current;
        aplicar(objs.map((o) => (o.id === gs.id ? movido : o)));
      } else if (gs.tipo === "texto" && !gs.arrastro) {
        const t = encima(x, y, 4);
        abrirTexto(t && t.type === "text" ? t : null, gs.x0, gs.y0);
      }
    }
    tempRef.current = null;
    ocultosRef.current = new Set();
    pedir();
  }

  function alSalir() {
    hoverRef.current = null;
    pedir();
  }

  function dobleClic(e) {
    if (herr !== "mover") return;
    const { x, y } = posicion(e);
    const o = encima(x, y, 6);
    if (o && o.type === "text") abrirTexto(o);
  }

  // ---------------- Acciones ----------------
  function elegirHerramienta(h) {
    if (texto) confirmarTexto();
    setHerr(h);
    setMenu(null);
    if (h !== "mover") setSeleccion(null);
  }
  function elegirForma(f) {
    setForma(f);
    elegirHerramienta("forma");
  }
  function cambiarColor(c) {
    setColor(c);
    if (objSel && herr === "mover") aplicar(pagina.objs.map((o) => (o.id === objSel.id ? { ...o, color: colorReal(c, oscuro) } : o)));
  }
  function cambiarGrosor(i) {
    setGrosor(i);
    if (objSel && herr === "mover") {
      const n = CONFIG.grosores[i];
      aplicar(pagina.objs.map((o) => (o.id === objSel.id ? (o.type === "text" ? { ...o, size: n.t } : { ...o, w: n.w }) : o)));
    }
  }
  function cambiarRelleno() {
    if (objSel && CON_RELLENO.has(objSel.type)) aplicar(pagina.objs.map((o) => (o.id === objSel.id ? { ...o, fill: !o.fill } : o)));
    else setRelleno(!relleno);
  }
  function borrarSeleccion() {
    if (!objSel) return;
    aplicar(pagina.objs.filter((o) => o.id !== objSel.id));
    setSeleccion(null);
  }
  function limpiarPagina() {
    if (texto) confirmarTexto();
    if (pag().objs.length) {
      aplicar([]);
      avisar("Página limpia · Ctrl+Z para recuperarla");
    }
    setSeleccion(null);
  }
  function cambiarFondo(id) {
    setMenu(null);
    if (id === pagina.fondo) return;
    const nuevoOscuro = fondoDe(id).oscuro;
    setPaginas(paginas.map((p) => (p.id === pagina.id ? { ...p, fondo: id } : p)));
    paginasRef.current = paginasRef.current.map((p) => (p.id === pagina.id ? { ...p, fondo: id } : p));
    // los dibujos NO se tocan; solo se avisa si alguno se vería poco con el nuevo fondo
    const poco = pagina.objs.filter((o) => o.type !== "erase" && (nuevoOscuro ? o.color === "#111827" : o.color === "#FFFFFF")).length;
    avisar(poco ? `Fondo cambiado · ${poco} trazo(s) se ven poco con este fondo (puedes cambiarles el color)` : `Fondo: ${fondoDe(id).nombre}`);
  }
  function irA(i) {
    if (texto) confirmarTexto();
    const n = Math.min(Math.max(0, i), paginas.length - 1);
    setActual(n);
    setSeleccion(null);
  }
  function agregarPagina() {
    if (texto) confirmarTexto();
    const p = paginaNueva(pagina.fondo);
    const nuevas = [...paginas.slice(0, idx + 1), p, ...paginas.slice(idx + 1)];
    paginasRef.current = nuevas;
    setPaginas(nuevas);
    setActual(idx + 1);
    setSeleccion(null);
    avisar(`Página ${idx + 2} agregada`);
  }
  function quitarPagina() {
    if (paginas.length === 1) return limpiarPagina();
    if (pagina.objs.length && !window.confirm(`¿Eliminar la página ${idx + 1}? No se puede deshacer.`)) return undefined;
    delete histRef.current[pagina.id];
    const nuevas = paginas.filter((p) => p.id !== pagina.id);
    paginasRef.current = nuevas;
    setPaginas(nuevas);
    setActual(Math.min(idx, nuevas.length - 1));
    setSeleccion(null);
    avisar("Página eliminada");
    return undefined;
  }
  function abrirDescarga() {
    const c = canvasRef.current;
    if (!c) return;
    if (textoRef.current) confirmarTexto();
    setMenu(null);
    const vista = renderPagina(pag(), c.clientWidth, c.clientHeight, 0.4).toDataURL("image/jpeg", 0.8);
    setDialogo({ vista });
  }
  async function exportar({ nombre: elegido, archivo, formato, alcance }) {
    const c = canvasRef.current;
    if (!c) return;
    const W = c.clientWidth;
    const H = c.clientHeight;
    setExportando(true);
    try {
      let nombreFinal = `${archivo}.${formato}`;
      if (formato === "pdf") {
        const lista = alcance === "todas" ? paginasRef.current : [pag()];
        const imgs = [];
        for (const p of lista) {
          const cv = renderPagina(p, W, H, 2);
          const blob = await aBlob(cv, "image/jpeg", 0.92);
          if (!blob) throw new Error("sin imagen");
          imgs.push({ w: cv.width, h: cv.height, bytes: new Uint8Array(await blob.arrayBuffer()) });
        }
        bajar(crearPDF(imgs, W * 0.75, H * 0.75, archivo), nombreFinal);
      } else {
        const blob = await aBlob(renderPagina(pag(), W, H, 2), formato === "jpg" ? "image/jpeg" : "image/png", 0.92);
        if (!blob) throw new Error("sin imagen");
        bajar(blob, nombreFinal);
      }
      // el nombre elegido pasa a ser el nombre del trabajo (salvo el automático)
      const limpio = elegido.trim();
      if (limpio && limpio !== `Pizarra ${hoy()}`) setNombre(limpio.slice(0, 80));
      setDialogo(null);
      avisar(`✓ Descargado: ${nombreFinal}`);
    } catch {
      avisar("No se pudo descargar. Inténtalo de nuevo.");
    } finally {
      setExportando(false);
    }
  }

  // Pantalla completa / modo proyección
  const puedePantallaCompleta = typeof document !== "undefined" && !!document.fullscreenEnabled;
  function alternarEnfoque() {
    if (enfoque) {
      setEnfoque(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else {
      setEnfoque(true);
      try {
        if (puedePantallaCompleta && !document.fullscreenElement) {
          usoPantallaCompleta.current = true;
          const r = document.documentElement.requestFullscreen();
          if (r && r.catch) r.catch(() => {});
        }
      } catch {
        /* algunos navegadores (p. ej. iPhone) no lo permiten: queda el modo sin barra */
      }
    }
  }
  useEffect(() => {
    const cambio = () => {
      if (!document.fullscreenElement && usoPantallaCompleta.current) {
        usoPantallaCompleta.current = false;
        setEnfoque(false); // al pulsar Esc se vuelve a ver la barra superior
      }
    };
    document.addEventListener("fullscreenchange", cambio);
    return () => document.removeEventListener("fullscreenchange", cambio);
  }, []);
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // ---------------- Menús: se abren solo al pulsar su botón y se cierran al tocar fuera ----------------
  useEffect(() => {
    if (!menu) return undefined;
    const fuera = (e) => {
      if (!e.target.closest || !e.target.closest(".pz-anchor")) setMenu(null);
    };
    document.addEventListener("pointerdown", fuera, true);
    return () => document.removeEventListener("pointerdown", fuera, true);
  }, [menu]);

  // ---------------- Atajos de teclado ----------------
  const accionesRef = useRef({});
  accionesRef.current = { deshacer, rehacer, borrarSeleccion, elegirHerramienta, setMenu, objSel, abrirDescarga };
  useEffect(() => {
    const alPulsar = (e) => {
      const t = e.target;
      const et = t && t.tagName;
      const a = accionesRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { // Ctrl+S = guardar / descargar
        e.preventDefault();
        if (!dialogoRef.current) a.abrirDescarga();
        return;
      }
      if (dialogoRef.current) return; // con el cuadro "Guardar" abierto no se cambian herramientas
      if (et === "INPUT" || et === "TEXTAREA" || et === "SELECT") return;
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) { e.preventDefault(); a.deshacer(); }
        else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); a.rehacer(); }
        return;
      }
      if (e.altKey) return;
      if ((e.key === "Delete" || e.key === "Backspace") && a.objSel) { e.preventDefault(); a.borrarSeleccion(); return; }
      if (e.key === "Escape") { a.setMenu(null); return; }
      const mapa = { v: "mover", p: "lapiz", h: "marcador", e: "borrador", t: "texto" };
      const h = mapa[e.key.toLowerCase()];
      if (h) { e.preventDefault(); a.elegirHerramienta(h); }
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, []);

  // ---------------- Interfaz ----------------
  const formaActual = FORMAS.find((f) => f.id === forma) || FORMAS[0];
  const mostrarRelleno = (herr === "forma" && CON_RELLENO.has(forma)) || (objSel && CON_RELLENO.has(objSel.type));
  const rellenoActivo = objSel && CON_RELLENO.has(objSel.type) ? !!objSel.fill : relleno;
  const colorMostrado = objSel && herr === "mover" ? objSel.color : color;
  const vacia = pagina.objs.length === 0 && !texto;
  const medida = texto ? medirTexto({ text: texto.value || " ", size: texto.size }) : null;
  const ayudaActual = texto
    ? "Escribiendo… Ctrl+Enter para terminar · Esc cancela"
    : herr === "mover" && objSel
      ? `${NOMBRES_OBJ[objSel.type] || "Elemento"} seleccionado · arrastra para mover · Supr para borrar`
      : AYUDA[herr];

  return (
    <div className={"app hr-page hr-fullh pz" + (enfoque ? " pz-enfoque" : "")}>
      {!enfoque && (
        <header className="ref-topbar">
          <Brand subtitle="Pizarra" onClick={goHome} />
          <div className="pz-titulo-caja">
            <input
              type="text"
              className="pz-titulo"
              value={nombre}
              maxLength={80}
              placeholder="Pizarra sin título"
              aria-label="Nombre del trabajo"
              title="Nombre del trabajo (se usa al descargar)"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
            />
            <span className={"pz-guardado pz-g-" + guardado} role="status">
              {guardado === "ok" ? "✓ Guardado en este equipo" : guardado === "pendiente" ? "Guardando…" : "⚠ No se pudo guardar (espacio lleno)"}
            </span>
          </div>
          <button className="hr-back" onClick={goHome}>← Volver al inicio</button>
        </header>
      )}

      <main className="pz-stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          className={"pz-canvas pz-c-" + herr}
          role="img"
          aria-label="Superficie de la pizarra"
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          onPointerLeave={alSalir}
          onDoubleClick={dobleClic}
        />

        {vacia && <div className="pz-hint" aria-hidden="true">Elige una herramienta y empieza a escribir o dibujar</div>}

        {texto && (
          <textarea
            ref={taRef}
            className="pz-texto"
            value={texto.value}
            spellCheck={false}
            aria-label="Escribe el texto"
            style={{
              left: texto.x,
              top: texto.y,
              fontSize: texto.size,
              lineHeight: 1.25,
              color: colorReal(texto.color, oscuro),
              width: Math.ceil(medida.w) + texto.size * 0.8,
              height: Math.ceil(medida.h) + 2,
              maxWidth: "calc(100% - 20px)",
            }}
            onChange={(e) => ponerTexto({ ...textoRef.current, value: e.target.value })}
            onBlur={confirmarTexto}
            onKeyDown={(e) => {
              if (e.key === "Escape") ponerTexto(null); // cancela
              else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") confirmarTexto();
              e.stopPropagation();
            }}
          />
        )}

        {/* ---- Herramientas (izquierda) ---- */}
        <div className="pz-panel pz-rail" role="toolbar" aria-label="Herramientas de la pizarra">
          <Btn n="mover" titulo="Seleccionar y mover (V)" activo={herr === "mover"} onClick={() => elegirHerramienta("mover")} />
          <Btn n="lapiz" titulo="Lápiz (P)" activo={herr === "lapiz"} onClick={() => elegirHerramienta("lapiz")} />
          <Btn n="marcador" titulo="Marcador resaltador (H)" activo={herr === "marcador"} onClick={() => elegirHerramienta("marcador")} />
          <Btn n="borrador" titulo="Borrador (E)" activo={herr === "borrador"} onClick={() => elegirHerramienta("borrador")} />
          <Btn n="texto" titulo="Texto (T)" activo={herr === "texto"} onClick={() => elegirHerramienta("texto")} />
          <div className="pz-anchor">
            <Btn n={herr === "forma" ? forma : "formas"} titulo="Formas y flechas" activo={herr === "forma"} onClick={() => setMenu(menu === "formas" ? null : "formas")} />
            {menu === "formas" && (
              <div className="pz-panel pz-fly">
                {FORMAS.map((f) => (
                  <button key={f.id} className="pz-item" aria-pressed={herr === "forma" && forma === f.id} onClick={() => elegirForma(f.id)}>
                    <Icono n={f.id} size={20} /> {f.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- Acciones (arriba a la derecha) ---- */}
        <div className="pz-top">
          <div className="pz-panel pz-group">
            <Btn n="deshacer" titulo="Deshacer (Ctrl+Z)" disabled={!hp.undo.length} onClick={deshacer} />
            <Btn n="rehacer" titulo="Rehacer (Ctrl+Y)" disabled={!hp.redo.length} onClick={rehacer} />
            {objSel && <Btn n="basura" titulo="Borrar lo seleccionado (Supr)" onClick={borrarSeleccion} />}
            <button className="pz-btn pz-txt" title="Limpiar toda la página (se puede deshacer)" disabled={!pagina.objs.length} onClick={limpiarPagina}>Limpiar</button>
          </div>
          <div className="pz-panel pz-group">
            <div className="pz-anchor">
              <Btn n="fondo" titulo={"Fondo: " + fondoDe(pagina.fondo).nombre} onClick={() => setMenu(menu === "fondo" ? null : "fondo")} />
              {menu === "fondo" && (
                <div className="pz-panel pz-fly pz-fly-abajo">
                  <div className="pz-fly-titulo">Fondo de esta página</div>
                  {CONFIG.fondos.map((f) => (
                    <button key={f.id} className="pz-item" aria-pressed={pagina.fondo === f.id} onClick={() => cambiarFondo(f.id)}>
                      <span className="pz-muestra" style={muestraFondo(f)} /> {f.nombre}
                      {pagina.fondo === f.id && <span className="pz-ok" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Btn n="izq" titulo="Página anterior" disabled={idx === 0} onClick={() => irA(idx - 1)} />
            <span className="pz-pag" aria-live="polite">{idx + 1}/{paginas.length}</span>
            <Btn n="der" titulo="Página siguiente" disabled={idx === paginas.length - 1} onClick={() => irA(idx + 1)} />
            <Btn n="mas" titulo="Nueva página" onClick={agregarPagina} />
            {paginas.length > 1 && <Btn n="basura" titulo="Eliminar esta página" onClick={quitarPagina} />}
          </div>
          <div className="pz-panel pz-group">
            <Btn n="descargar" titulo="Guardar / descargar (Ctrl+S)" onClick={abrirDescarga} />
            <Btn n={enfoque ? "cerrar" : "pantalla"} titulo={enfoque ? "Salir de pantalla completa" : "Pantalla completa"} onClick={alternarEnfoque} />
          </div>
        </div>

        {/* ---- Qué se está haciendo ahora (herramienta, grosor, color y medidas en vivo) ---- */}
        <div className={"pz-estado" + (vivo ? " pz-vivo-on" : "")} aria-live="polite">
          <Icono n={herr === "forma" ? forma : herr} size={16} />
          <b>{NOMBRES_HERR[herr]}{herr === "forma" ? ": " + formaActual.nombre : ""}</b>
          {herr !== "mover" && herr !== "borrador" && (
            <>
              <i className="pz-dot" style={{ background: colorReal(colorMostrado, oscuro) }} />
              <span>{g.nombre}</span>
            </>
          )}
          <span className="pz-estado-txt">{vivo || ayudaActual}</span>
        </div>
        {aviso && <div className="pz-aviso" role="status">{aviso}</div>}

        {dialogo && (
          <DialogoDescarga
            vista={dialogo.vista}
            nombreInicial={nombre.trim() || `Pizarra ${hoy()}`}
            paginas={paginas.length}
            ocupado={exportando}
            onCancelar={() => setDialogo(null)}
            onConfirmar={exportar}
          />
        )}

        {/* ---- Color, grosor y relleno (abajo al centro) ---- */}
        <div className="pz-panel pz-bottom" role="group" aria-label="Color y grosor">
          <div className="pz-colores">
            {CONFIG.colores.map((c) => (
              <button
                key={c}
                className="pz-sw"
                aria-label={c === "auto" ? "Negro (blanco en fondo oscuro)" : "Color " + c}
                title={c === "auto" ? "Negro / blanco" : c}
                aria-pressed={colorMostrado === c || (c === "auto" && colorMostrado === colorReal("auto", oscuro))}
                style={{ background: colorReal(c, oscuro) }}
                onClick={() => cambiarColor(c)}
              />
            ))}
            <label className="pz-sw pz-custom" title="Otro color" aria-label="Elegir otro color">
              <input type="color" value={colorReal(colorMostrado, oscuro).slice(0, 7)} onChange={(e) => cambiarColor(e.target.value.toUpperCase())} />
            </label>
          </div>
          <span className="pz-sep" />
          <div className="pz-grosores" role="group" aria-label="Grosor">
            {CONFIG.grosores.map((x, i) => (
              <button key={x.nombre} className="pz-gr" title={`${x.nombre} (texto: ${["pequeño", "mediano", "grande"][i]})`} aria-label={x.nombre} aria-pressed={grosor === i} onClick={() => cambiarGrosor(i)}>
                <i style={{ width: 6 + i * 6, height: 6 + i * 6 }} />
              </button>
            ))}
          </div>
          {mostrarRelleno && (
            <>
              <span className="pz-sep" />
              <button className="pz-btn pz-txt" aria-pressed={rellenoActivo} onClick={cambiarRelleno} title="Rellenar la forma con color">Relleno</button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
