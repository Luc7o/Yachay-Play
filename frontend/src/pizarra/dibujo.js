import { CONFIG, TAU } from "./config";
import { fondoDe, colorReal, fuenteTexto } from "./utils";
import { vertices } from "./geometria";

// ---------------- Dibujo ----------------
export function trazar(ctx, o, oscuro) {
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

export function pintarFondo(ctx, W, H, idFondo) {
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

export let capa = null; // lienzo auxiliar: aquí se dibujan los trazos para poder borrarlos sin tocar el fondo

export function dibujarEscena(ctx, W, H, pagina, ocultos, extra) {
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
