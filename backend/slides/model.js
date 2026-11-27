// ============================================================================
// MODELO COMPARTIDO DE "PRESENTACIONES EN VIVO"
// ============================================================================
// Este archivo es IDÉNTICO en backend/slides/model.js y frontend/src/estudio/model.js.
// Si cambias uno, copia el cambio al otro (el servidor y el navegador aplican
// exactamente las mismas operaciones para quedar siempre iguales).
//
// Una presentación (deck) es:  { slides: [ { id, bg, elements: [ ... ] } ] }
// Cada elemento:  { id, type: "text" | "rect" | "ellipse" | "image",
//                   x, y, w, h  (en un lienzo lógico de 960 x 540),
//                   text, size, color, bold, align, fill, src }
// ============================================================================

export const W = 960;
export const H = 540;
export const LIMITES = {
  slides: 40,
  elementos: 60,
  texto: 2000,
  imagen: 450000, // caracteres del dataURL (~330 KB de imagen)
  nombre: 40,
  comentario: 400,
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const IMG = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const TIPOS = ["text", "rect", "ellipse", "image"];
const ALINEA = ["left", "center", "right"];
const ids = () => Math.random().toString(36).slice(2, 10);
export const nuevoId = ids;

const num = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const color = (v, def) => (typeof v === "string" && HEX.test(v) ? v : def);

// ----------------------- fábricas -----------------------
export function elementoTexto(over = {}) {
  return {
    id: ids(),
    type: "text",
    x: 80,
    y: 80,
    w: 800,
    h: 90,
    text: "Escribe aquí",
    size: 36,
    color: "#143841",
    bold: false,
    italic: false,
    underline: false,
    align: "left",
    ...over,
  };
}
export function elementoForma(type, over = {}) {
  return { id: ids(), type, x: 360, y: 190, w: 240, h: 160, fill: "#00A996", ...over };
}
export function elementoImagen(src, w, h) {
  const r = Math.min(600 / w, 380 / h, 1);
  const ww = Math.round(w * r),
    hh = Math.round(h * r);
  return { id: ids(), type: "image", x: Math.round((W - ww) / 2), y: Math.round((H - hh) / 2), w: ww, h: hh, src };
}
export function diapositiva(plantilla = "blanco") {
  const s = { id: ids(), bg: "#ffffff", elements: [] };
  if (plantilla === "titulo") {
    s.elements.push(
      elementoTexto({ y: 170, h: 110, size: 60, bold: true, align: "center", text: "Título de la presentación" }),
    );
    s.elements.push(
      elementoTexto({ y: 300, h: 70, size: 28, align: "center", color: "#416773", text: "Tu nombre · Curso" }),
    );
  } else if (plantilla === "contenido") {
    s.elements.push(elementoTexto({ y: 40, h: 90, size: 44, bold: true, text: "Título de la diapositiva" }));
    s.elements.push(
      elementoTexto({ y: 150, h: 330, size: 28, text: "• Primera idea\n• Segunda idea\n• Tercera idea" }),
    );
  }
  return s;
}
export const deckInicial = () => ({ slides: [diapositiva("titulo")] });

// ----------------------- validación (el servidor NO se fía del navegador) -----------------------
export function limpiarElemento(el) {
  if (!el || typeof el !== "object" || !TIPOS.includes(el.type)) return null;
  const out = {
    id: String(el.id || ids()).slice(0, 16),
    type: el.type,
    x: num(el.x, -W, W * 2, 0),
    y: num(el.y, -H, H * 2, 0),
    w: num(el.w, 10, W * 2, 100),
    h: num(el.h, 10, H * 2, 60),
  };
  if (el.type === "text") {
    out.text = String(el.text ?? "").slice(0, LIMITES.texto);
    out.size = num(el.size, 8, 200, 32);
    out.color = color(el.color, "#143841");
    out.bold = !!el.bold;
    out.italic = !!el.italic;
    out.underline = !!el.underline;
    out.align = ALINEA.includes(el.align) ? el.align : "left";
  } else if (el.type === "image") {
    if (typeof el.src !== "string" || el.src.length > LIMITES.imagen || !IMG.test(el.src)) return null;
    out.src = el.src;
  } else {
    out.fill = color(el.fill, "#00A996");
  }
  return out;
}
function limpiarParche(p) {
  const out = {};
  if (!p || typeof p !== "object") return out;
  for (const k of ["x", "y"]) if (k in p) out[k] = num(p[k], k === "x" ? -W : -H, k === "x" ? W * 2 : H * 2, 0);
  for (const k of ["w", "h"]) if (k in p) out[k] = num(p[k], 10, W * 2, 60);
  if ("text" in p) out.text = String(p.text ?? "").slice(0, LIMITES.texto);
  if ("size" in p) out.size = num(p.size, 8, 200, 32);
  if ("color" in p) out.color = color(p.color, "#143841");
  if ("fill" in p) out.fill = color(p.fill, "#00A996");
  if ("bold" in p) out.bold = !!p.bold;
  if ("italic" in p) out.italic = !!p.italic;
  if ("underline" in p) out.underline = !!p.underline;
  if ("align" in p) out.align = ALINEA.includes(p.align) ? p.align : "left";
  return out;
}
export function limpiarDiapositiva(s) {
  if (!s || typeof s !== "object") return null;
  const els = Array.isArray(s.elements)
    ? s.elements.slice(0, LIMITES.elementos).map(limpiarElemento).filter(Boolean)
    : [];
  return { id: String(s.id || ids()).slice(0, 16), bg: color(s.bg, "#ffffff"), elements: els };
}
// Devuelve la operación limpia o null si no es válida.
export function limpiarOp(op) {
  if (!op || typeof op !== "object") return null;
  const sid = String(op.sid || "").slice(0, 16);
  switch (op.t) {
    case "slide+": {
      const s = limpiarDiapositiva(op.slide);
      return s ? { t: "slide+", slide: s, index: num(op.index, 0, LIMITES.slides, 0) } : null;
    }
    case "slide-":
      return { t: "slide-", id: String(op.id || "").slice(0, 16) };
    case "slide~":
      return { t: "slide~", id: String(op.id || "").slice(0, 16), bg: color(op.bg, "#ffffff") };
    case "slide>":
      return { t: "slide>", id: String(op.id || "").slice(0, 16), to: num(op.to, 0, LIMITES.slides, 0) };
    case "el+": {
      const e = limpiarElemento(op.el);
      return e ? { t: "el+", sid, el: e } : null;
    }
    case "el~":
      return { t: "el~", sid, id: String(op.id || "").slice(0, 16), patch: limpiarParche(op.patch) };
    case "el-":
      return { t: "el-", sid, id: String(op.id || "").slice(0, 16) };
    case "el^":
      return { t: "el^", sid, id: String(op.id || "").slice(0, 16), z: op.z === "back" ? "back" : "front" };
    default:
      return null;
  }
}

// ----------------------- reductor: aplica una operación y devuelve un deck nuevo -----------------------
export function aplicarOp(deck, op) {
  const slides = deck.slides;
  const enSlide = (sid, f) => ({ ...deck, slides: slides.map((s) => (s.id === sid ? f(s) : s)) });
  switch (op.t) {
    case "slide+": {
      if (slides.length >= LIMITES.slides || slides.some((s) => s.id === op.slide.id)) return deck;
      const i = Math.min(op.index, slides.length);
      return { ...deck, slides: [...slides.slice(0, i), op.slide, ...slides.slice(i)] };
    }
    case "slide-":
      if (slides.length <= 1) return deck; // siempre queda al menos una
      return { ...deck, slides: slides.filter((s) => s.id !== op.id) };
    case "slide~":
      return enSlide(op.id, (s) => ({ ...s, bg: op.bg }));
    case "slide>": {
      const from = slides.findIndex((s) => s.id === op.id);
      if (from < 0) return deck;
      const arr = slides.slice();
      const [s] = arr.splice(from, 1);
      arr.splice(Math.min(op.to, arr.length), 0, s);
      return { ...deck, slides: arr };
    }
    case "el+":
      return enSlide(op.sid, (s) => {
        const ya = s.elements.some((e) => e.id === op.el.id);
        if (!ya && s.elements.length >= LIMITES.elementos) return s;
        return { ...s, elements: ya ? s.elements.map((e) => (e.id === op.el.id ? op.el : e)) : [...s.elements, op.el] };
      });
    case "el~":
      return enSlide(op.sid, (s) => ({
        ...s,
        elements: s.elements.map((e) => (e.id === op.id ? { ...e, ...op.patch } : e)),
      }));
    case "el-":
      return enSlide(op.sid, (s) => ({ ...s, elements: s.elements.filter((e) => e.id !== op.id) }));
    case "el^":
      return enSlide(op.sid, (s) => {
        const e = s.elements.find((x) => x.id === op.id);
        if (!e) return s;
        const resto = s.elements.filter((x) => x.id !== op.id);
        return { ...s, elements: op.z === "back" ? [e, ...resto] : [...resto, e] };
      });
    default:
      return deck;
  }
}

export function limpiarDeck(d) {
  const slides = Array.isArray(d?.slides)
    ? d.slides.slice(0, LIMITES.slides).map(limpiarDiapositiva).filter(Boolean)
    : [];
  return { slides: slides.length ? slides : deckInicial().slides };
}
