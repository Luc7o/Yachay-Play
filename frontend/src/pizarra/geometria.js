import { fuenteTexto } from "./utils";

// ---------------- Geometría de los objetos ----------------
export let medidor = null;

export function medirTexto(o) {
  if (!medidor) medidor = document.createElement("canvas").getContext("2d");
  medidor.font = fuenteTexto(o.size);
  const lineas = o.text.split("\n");
  const w = Math.max(10, ...lineas.map((l) => medidor.measureText(l).width));
  return { w, h: lineas.length * o.size * 1.25, lineas };
}

export function cajaDe(o) {
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

export function distSegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function vertices(o) {
  const x1 = Math.min(o.x1, o.x2);
  const x2 = Math.max(o.x1, o.x2);
  const y1 = Math.min(o.y1, o.y2);
  const y2 = Math.max(o.y1, o.y2);
  if (o.type === "tri") return [[(x1 + x2) / 2, y1], [x2, y2], [x1, y2]];
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]; // rect
}

// ¿El punto (x, y) está tocando este objeto? tol = margen en píxeles
export function toca(o, x, y, tol) {
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

export function mover(o, dx, dy) {
  if (o.pts) return { ...o, pts: o.pts.map((p) => [p[0] + dx, p[1] + dy]) };
  if (o.type === "text") return { ...o, x: o.x + dx, y: o.y + dy };
  return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
}

// Con Shift: línea en ángulos de 45°, y cuadrado / círculo perfecto
export function restringir(tipo, x1, y1, x, y) {
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
