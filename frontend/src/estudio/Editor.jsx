import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconoEnLinea } from "../campusUi";
import {
  W,
  H,
  LIMITES,
  aplicarOp,
  diapositiva,
  elementoForma,
  elementoImagen,
  elementoTexto,
  limpiarElemento,
  nuevoId,
} from "./model";
import { ElementoVista, SlideView } from "./SlideView";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "../ui";

// ---------- utilidades ----------
function inverso(deck, op) {
  const slide = deck.slides.find((s) => s.id === op.sid);
  const el = slide?.elements.find((e) => e.id === op.id || e.id === op.el?.id);
  switch (op.t) {
    case "el+":
      return el ? { t: "el+", sid: op.sid, el } : { t: "el-", sid: op.sid, id: op.el.id };
    case "el-":
      return el ? { t: "el+", sid: op.sid, el } : null;
    case "el~": {
      if (!el) return null;
      const prev = {};
      for (const k of Object.keys(op.patch)) prev[k] = el[k];
      return { t: "el~", sid: op.sid, id: op.id, patch: prev };
    }
    case "slide+":
      return { t: "slide-", id: op.slide.id };
    case "slide-": {
      const i = deck.slides.findIndex((s) => s.id === op.id);
      return i < 0 ? null : { t: "slide+", slide: deck.slides[i], index: i };
    }
    case "slide~": {
      const s = deck.slides.find((x) => x.id === op.id);
      return s ? { t: "slide~", id: op.id, bg: s.bg } : null;
    }
    case "slide>": {
      const i = deck.slides.findIndex((s) => s.id === op.id);
      return i < 0 ? null : { t: "slide>", id: op.id, to: i };
    }
    default:
      return null;
  }
}

// Reduce la imagen en el navegador para que pese poco (el servidor limita ~330 KB).
function leerImagen(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let lado = 1100;
      for (let i = 0; i < 6; i++) {
        const r = Math.min(1, lado / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * r));
        c.height = Math.max(1, Math.round(img.height * r));
        const g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        const src = c.toDataURL("image/jpeg", i < 3 ? 0.8 : 0.6);
        if (src.length <= LIMITES.imagen) return res({ src, w: c.width, h: c.height });
        lado *= 0.75;
      }
      rej(new Error("La imagen es demasiado pesada. Prueba con otra más pequeña."));
    };
    img.onerror = () => rej(new Error("No se pudo leer esa imagen."));
    img.src = url;
  });
}

const PLANTILLAS = [
  ["blanco", "En blanco"],
  ["titulo", "Portada"],
  ["contenido", "Título y texto"],
];

// ============================================================================
// EDITOR DE DIAPOSITIVAS
//   deck       -> la presentación { slides }
//   onOp(op)   -> avisa de CADA cambio (para guardarlo y enviarlo por socket)
//   remoteOps  -> contador que sube cuando llega un cambio ajeno (para refrescar la selección)
//   readOnly   -> true: solo mirar (docente, edición bloqueada, sin conexión)
//   comments   -> { [slideId]: [{text,time}] } comentarios del docente
//   onView     -> se llama al cambiar de diapositiva
//   sidebar    -> contenido extra del panel derecho (p. ej. cuadro para comentar)
// ============================================================================
export function Editor({
  deck,
  setDeck,
  onOp,
  readOnly,
  comments = {},
  onView,
  sidebar,
  topLeft,
  topRight,
  aviso,
  initialSlideId,
}) {
  const [sel, setSel] = useState(null); // id del elemento seleccionado
  const [editing, setEditing] = useState(null); // id del texto que se está escribiendo
  const [slideId, setSlideId] = useState(() =>
    initialSlideId && deck.slides.some((s) => s.id === initialSlideId) ? initialSlideId : deck.slides[0].id,
  );
  const [presentando, setPresentando] = useState(null); // null = no se presenta; número = diapositiva de inicio
  const [ayuda, setAyuda] = useState(false); // panel de atajos
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const redo = useRef([]);
  const [redoN, setRedoN] = useState(0);
  const pegados = useRef(0); // para que pegar varias veces seguidas no apile todo en el mismo lugar
  const [menuNueva, setMenuNueva] = useState(false);
  const [error, setError] = useState("");
  const [undoN, setUndoN] = useState(0);
  const undo = useRef([]);
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const stageBox = useRef(null);
  const [caja, setCaja] = useState({ w: 800, h: 450 });
  const fileRef = useRef(null);
  const ultimoEnvio = useRef(0);

  // Si la diapositiva actual desapareció (la borró un compañero), pasamos a otra.
  const slide = deck.slides.find((s) => s.id === slideId) || deck.slides[0];
  useEffect(() => {
    if (slide.id !== slideId) setSlideId(slide.id);
  }, [slide.id, slideId]);
  useEffect(() => {
    onView?.(slide.id);
  }, [slide.id]); // eslint-disable-line
  const elSel = slide.elements.find((e) => e.id === sel) || null;
  useEffect(() => {
    if (sel && !elSel) {
      setSel(null);
      setEditing(null);
    }
  }, [sel, elSel]);

  // Medir el espacio disponible para escalar el lienzo 960x540
  useEffect(() => {
    const el = stageBox.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setCaja({ w: Math.max(200, r.width - 24), h: Math.max(120, r.height - 24) });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const escala = Math.min(caja.w / W, caja.h / H);

  // ---- aplicar un cambio propio: local + aviso al servidor ----
  const commit = useCallback(
    (op, { guardarUndo = true, enviar = true } = {}) => {
      if (readOnly) return;
      const d = deckRef.current;
      if (guardarUndo) {
        const inv = inverso(d, op);
        if (inv) {
          undo.current.push(inv);
          if (undo.current.length > 50) undo.current.shift();
          setUndoN(undo.current.length);
          redo.current = [];
          setRedoN(0);
        }
      }
      const nuevo = aplicarOp(d, op);
      deckRef.current = nuevo;
      setDeck(nuevo);
      if (enviar) onOp(op);
    },
    [readOnly, setDeck, onOp],
  );

  const deshacer = () => {
    const inv = undo.current.pop();
    setUndoN(undo.current.length);
    if (!inv) return;
    const rehacerOp = inverso(deckRef.current, inv); // lo que hace falta para volver a como estaba antes de deshacer
    if (rehacerOp) {
      redo.current.push(rehacerOp);
      setRedoN(redo.current.length);
    }
    commit(inv, { guardarUndo: false });
  };
  const rehacer = () => {
    const op = redo.current.pop();
    setRedoN(redo.current.length);
    if (!op) return;
    const inv = inverso(deckRef.current, op);
    if (inv) {
      undo.current.push(inv);
      setUndoN(undo.current.length);
    }
    commit(op, { guardarUndo: false });
  };
  const avisarToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const irADiapositiva = (i) => {
    const s = deck.slides[Math.max(0, Math.min(deck.slides.length - 1, i))];
    if (s) {
      setSlideId(s.id);
      setSel(null);
      setEditing(null);
    }
  };

  // ---- acciones ----
  const addEl = (el, editar = false) => {
    commit({ t: "el+", sid: slide.id, el });
    setSel(el.id);
    setEditing(editar ? el.id : null);
  };
  const patch = (id, p, opts) => commit({ t: "el~", sid: slide.id, id, patch: p }, opts);
  const borrar = () => {
    if (elSel) {
      commit({ t: "el-", sid: slide.id, id: elSel.id });
      setSel(null);
    }
  };
  const duplicar = () => {
    if (elSel) addEl({ ...elSel, id: nuevoId(), x: elSel.x + 24, y: elSel.y + 24 });
  };

  const nuevaDiapositiva = (plantilla) => {
    const s = diapositiva(plantilla);
    const i = deck.slides.findIndex((x) => x.id === slide.id) + 1;
    commit({ t: "slide+", slide: s, index: i });
    setSlideId(s.id);
    setSel(null);
    setMenuNueva(false);
  };
  const duplicarDiapositiva = (s) => {
    const copia = { ...s, id: nuevoId(), elements: s.elements.map((e) => ({ ...e, id: nuevoId() })) };
    commit({ t: "slide+", slide: copia, index: deck.slides.findIndex((x) => x.id === s.id) + 1 });
    setSlideId(copia.id);
  };
  const borrarDiapositiva = (s) => {
    if (deck.slides.length <= 1) return;
    if (!window.confirm("¿Borrar esta diapositiva?")) return;
    const i = deck.slides.findIndex((x) => x.id === s.id);
    commit({ t: "slide-", id: s.id });
    setSlideId(deck.slides[i + 1]?.id || deck.slides[i - 1].id);
  };
  const mover = (s, d) => {
    const i = deck.slides.findIndex((x) => x.id === s.id);
    const to = i + d;
    if (to >= 0 && to < deck.slides.length) commit({ t: "slide>", id: s.id, to });
  };

  async function subirImagen(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    try {
      const { src, w, h } = await leerImagen(f);
      addEl(elementoImagen(src, w, h));
    } catch (er) {
      setError(er.message);
    }
  }

  // ---- teclado: atajos como en Canva / PowerPoint / Google Slides (la lista completa está en "⌨ Atajos") ----
  const cambiarTamano = (d) =>
    elSel && elSel.type === "text" && patch(elSel.id, { size: Math.max(8, Math.min(200, elSel.size + d)) });
  const alinear = (a) => elSel && elSel.type === "text" && patch(elSel.id, { align: a });
  const orden = (z) => elSel && commit({ t: "el^", sid: slide.id, id: elSel.id, z });

  useEffect(() => {
    function onKey(e) {
      if (presentando !== null) return;
      const activo = document.activeElement;
      const enCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(activo?.tagName) || !!activo?.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      const k = (e.key || "").toLowerCase();

      // Panel de atajos abierto: solo se cierra
      if (ayuda) {
        if (e.key === "Escape" || e.key === "?" || (mod && e.key === "/")) {
          e.preventDefault();
          setAyuda(false);
        }
        return;
      }

      // Valen aunque se esté escribiendo
      if (mod && k === "s") {
        e.preventDefault();
        avisarToast("✔ Todo se guarda solo: no hace falta guardar.");
        return;
      }
      if (e.key === "F5") {
        e.preventDefault();
        setPresentando(e.shiftKey ? deck.slides.findIndex((s) => s.id === slide.id) : 0);
        return;
      }
      if (mod && e.key === "Enter" && !enCampo) {
        e.preventDefault();
        setPresentando(deck.slides.findIndex((s) => s.id === slide.id));
        return;
      }
      if (enCampo) return;

      if (e.key === "?" || (mod && e.key === "/")) {
        e.preventDefault();
        setAyuda(true);
        return;
      }
      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        deshacer();
        return;
      }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) {
        e.preventDefault();
        rehacer();
        return;
      }

      // Moverse entre diapositivas (también al mirar sin poder editar)
      const iActual = deck.slides.findIndex((s) => s.id === slide.id);
      if (e.key === "PageDown") {
        e.preventDefault();
        irADiapositiva(iActual + 1);
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        irADiapositiva(iActual - 1);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        irADiapositiva(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        irADiapositiva(deck.slides.length - 1);
        return;
      }
      if (!elSel && !mod && !e.altKey && e.key.startsWith("Arrow")) {
        e.preventDefault();
        irADiapositiva(iActual + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1));
        return;
      }
      if (e.key === "Escape") {
        setSel(null);
        setEditing(null);
        return;
      }
      if (e.key === "Tab" && slide.elements.length) {
        e.preventDefault();
        const n = slide.elements.length;
        const i = slide.elements.findIndex((x) => x.id === sel);
        setSel(slide.elements[(i + (e.shiftKey ? -1 : 1) + n) % n].id);
        setEditing(null);
        return;
      }
      if (readOnly) return;

      // Diapositivas
      if (mod && k === "m") {
        e.preventDefault();
        nuevaDiapositiva("blanco");
        return;
      }
      if (e.altKey && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        mover(slide, e.key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (mod && k === "d") {
        e.preventDefault();
        if (elSel) duplicar();
        else duplicarDiapositiva(slide);
        return;
      }

      // Insertar con una tecla (como en Canva)
      if (!mod && !e.altKey && !e.shiftKey && ["t", "r", "c"].includes(k)) {
        e.preventDefault();
        if (k === "t") addEl(elementoTexto(), true);
        else if (k === "r") addEl(elementoForma("rect"));
        else addEl(elementoForma("ellipse", { w: 200, h: 200 }));
        return;
      }
      if (!elSel) return;

      // Con un elemento seleccionado
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        borrar();
        return;
      }
      if ((e.key === "Enter" || e.key === "F2") && elSel.type === "text") {
        e.preventDefault();
        setEditing(elSel.id);
        return;
      }
      if (mod && elSel.type === "text") {
        if (k === "b" && !e.shiftKey) {
          e.preventDefault();
          patch(elSel.id, { bold: !elSel.bold });
          return;
        }
        if (k === "i" && !e.shiftKey) {
          e.preventDefault();
          patch(elSel.id, { italic: !elSel.italic });
          return;
        }
        if (k === "u" && !e.shiftKey) {
          e.preventDefault();
          patch(elSel.id, { underline: !elSel.underline });
          return;
        }
        if (e.shiftKey && k === "l") {
          e.preventDefault();
          alinear("left");
          return;
        }
        if (e.shiftKey && k === "e") {
          e.preventDefault();
          alinear("center");
          return;
        }
        if (e.shiftKey && k === "r") {
          e.preventDefault();
          alinear("right");
          return;
        }
        if (e.shiftKey && (e.key === ">" || e.key === ".")) {
          e.preventDefault();
          cambiarTamano(4);
          return;
        }
        if (e.shiftKey && (e.key === "<" || e.key === ",")) {
          e.preventDefault();
          cambiarTamano(-4);
          return;
        }
        if (!e.shiftKey && e.code === "BracketRight") {
          e.preventDefault();
          cambiarTamano(2);
          return;
        }
        if (!e.shiftKey && e.code === "BracketLeft") {
          e.preventDefault();
          cambiarTamano(-2);
          return;
        }
      }
      if (mod && e.shiftKey && (e.key === "ArrowUp" || e.code === "BracketRight")) {
        e.preventDefault();
        orden("front");
        return;
      }
      if (mod && e.shiftKey && (e.key === "ArrowDown" || e.code === "BracketLeft")) {
        e.preventDefault();
        orden("back");
        return;
      }
      if (!mod && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const p = e.shiftKey ? 20 : 4;
        patch(
          elSel.id,
          {
            x: elSel.x + (e.key === "ArrowRight" ? p : e.key === "ArrowLeft" ? -p : 0),
            y: elSel.y + (e.key === "ArrowDown" ? p : e.key === "ArrowUp" ? -p : 0),
          },
          { guardarUndo: false },
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- copiar / cortar / pegar (Ctrl+C, Ctrl+X, Ctrl+V): también entre salas y con imágenes o texto del portapapeles ----
  useEffect(() => {
    const MARCA = "yachayplay-el:";
    const enCampo = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    const onCopy = (e) => {
      if (presentando !== null || enCampo() || !elSel) return;
      e.preventDefault();
      e.clipboardData.setData("text/plain", MARCA + JSON.stringify(elSel));
      pegados.current = 0;
      avisarToast("Copiado");
    };
    const onCut = (e) => {
      if (presentando !== null || enCampo() || !elSel || readOnly) return;
      onCopy(e);
      borrar();
    };
    const onPaste = (e) => {
      if (presentando !== null || enCampo() || readOnly) return;
      const dt = e.clipboardData;
      if (!dt) return;
      const texto = dt.getData("text/plain") || "";
      if (texto.startsWith(MARCA)) {
        try {
          const el = limpiarElemento(JSON.parse(texto.slice(MARCA.length)));
          if (el) {
            e.preventDefault();
            const d = 24 * ++pegados.current;
            addEl({ ...el, id: nuevoId(), x: el.x + d, y: el.y + d });
            return;
          }
        } catch {
          /* no era uno de los nuestros: se trata como texto normal */
        }
      }
      const img = [...(dt.files || [])].find((f) => f.type.startsWith("image/"));
      if (img) {
        e.preventDefault();
        setError("");
        leerImagen(img)
          .then(({ src, w, h }) => addEl(elementoImagen(src, w, h)))
          .catch((er) => setError(er.message));
        return;
      }
      if (texto.trim()) {
        e.preventDefault();
        addEl(elementoTexto({ text: texto.slice(0, LIMITES.texto) }));
      }
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  });

  // ---- arrastrar y redimensionar ----
  function empezar(e, el, modo) {
    if (readOnly || editing === el.id) return;
    e.stopPropagation();
    if (editing) document.activeElement?.blur?.(); // guarda el texto que se estaba escribiendo
    setSel(el.id);
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const ini = { px: e.clientX, py: e.clientY, x: el.x, y: el.y, w: el.w, h: el.h, mov: false };
    const prev = {};
    const mover = (ev) => {
      const dx = (ev.clientX - ini.px) / escala,
        dy = (ev.clientY - ini.py) / escala;
      if (!ini.mov && Math.hypot(dx, dy) < 3) return;
      ini.mov = true;
      let p;
      if (modo === "mover") p = { x: Math.round(ini.x + dx), y: Math.round(ini.y + dy) };
      else {
        const w = Math.max(30, Math.round(ini.w + dx));
        p =
          el.type === "image"
            ? { w, h: Math.round((w * ini.h) / ini.w) }
            : { w, h: Math.max(30, Math.round(ini.h + dy)) };
      }
      Object.assign(prev, p);
      const ahora = Date.now();
      const enviar = ahora - ultimoEnvio.current > 90; // no saturar el servidor mientras se arrastra
      if (enviar) ultimoEnvio.current = ahora;
      commit({ t: "el~", sid: slide.id, id: el.id, patch: p }, { guardarUndo: false, enviar });
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (!ini.mov) return;
      onOp({ t: "el~", sid: slide.id, id: el.id, patch: prev }); // posición final, siempre
      const antes = modo === "mover" ? { x: ini.x, y: ini.y } : { w: ini.w, h: ini.h };
      undo.current.push({ t: "el~", sid: slide.id, id: el.id, patch: antes });
      setUndoN(undo.current.length);
      redo.current = [];
      setRedoN(0);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  }

  // ---- presentar ----
  const coments = comments[slide.id] || [];
  const bloqueado = readOnly;

  return (
    <div className="es-ed">
      {presentando !== null && <Presentar deck={deck} inicio={presentando} onSalir={() => setPresentando(null)} />}
      {ayuda && <Atajos onCerrar={() => setAyuda(false)} />}
      {toast && (
        <div className="es-toast" role="status">
          {toast}
        </div>
      )}
      <header className="es-top">
        <div className="es-top-l">{topLeft}</div>
        <div className="es-top-r">
          {topRight}
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => setAyuda(true)} title="Atajos de teclado (?)">
            ⌨ Atajos
          </Button>
          <Button
            size="sm"
            onClick={() =>
              setPresentando(
                Math.max(
                  0,
                  deck.slides.findIndex((s) => s.id === slide.id),
                ),
              )
            }
            title="Presentar desde esta diapositiva (Ctrl + Enter). Desde el inicio: F5"
          >
            ▶ Presentar
          </Button>
        </div>
      </header>
      {aviso && <div className="es-aviso">{aviso}</div>}

      {/* Barra de herramientas */}
      <div className="es-tools" role="toolbar" aria-label="Herramientas">
        <button className="es-t" disabled={bloqueado} onClick={() => addEl(elementoTexto(), true)}>
          Aa Texto
        </button>
        <button className="es-t" disabled={bloqueado} onClick={() => addEl(elementoForma("rect"))}>
          ▭ Cuadro
        </button>
        <button
          className="es-t"
          disabled={bloqueado}
          onClick={() => addEl(elementoForma("ellipse", { w: 200, h: 200 }))}
        >
          ◯ Círculo
        </button>
        <button className="es-t" disabled={bloqueado} onClick={() => fileRef.current?.click()}>
          <IconoEnLinea nombre="imagen" />
          Imagen
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={subirImagen}
        />
        <span className="es-sep" />
        <button className="es-t" disabled={bloqueado || !undoN} onClick={deshacer} title="Ctrl + Z">
          ↶ Deshacer
        </button>
        <button
          className="es-t"
          disabled={bloqueado || !redoN}
          onClick={rehacer}
          title="Ctrl + Y  (o Ctrl + Shift + Z)"
        >
          ↷ Rehacer
        </button>
        <label className="es-t es-color" title="Color de fondo de la diapositiva">
          Fondo{" "}
          <input
            type="color"
            disabled={bloqueado}
            value={slide.bg}
            onChange={(e) => commit({ t: "slide~", id: slide.id, bg: e.target.value })}
          />
        </label>
        {elSel && !bloqueado && (
          <>
            <span className="es-sep" />
            {elSel.type === "text" && (
              <>
                <button
                  className="es-t"
                  onClick={() => patch(elSel.id, { size: Math.max(8, elSel.size - 4) })}
                  aria-label="Letra más pequeña"
                >
                  A−
                </button>
                <span className="es-num">{elSel.size}</span>
                <button
                  className="es-t"
                  onClick={() => patch(elSel.id, { size: Math.min(200, elSel.size + 4) })}
                  aria-label="Letra más grande"
                >
                  A+
                </button>
                <button
                  className={"es-t" + (elSel.bold ? " on" : "")}
                  onClick={() => patch(elSel.id, { bold: !elSel.bold })}
                  title="Negrita (Ctrl + B)"
                >
                  <b>N</b>
                </button>
                <button
                  className={"es-t" + (elSel.italic ? " on" : "")}
                  onClick={() => patch(elSel.id, { italic: !elSel.italic })}
                  title="Cursiva (Ctrl + I)"
                >
                  <i>K</i>
                </button>
                <button
                  className={"es-t" + (elSel.underline ? " on" : "")}
                  onClick={() => patch(elSel.id, { underline: !elSel.underline })}
                  title="Subrayado (Ctrl + U)"
                >
                  <u>S</u>
                </button>
                {["left", "center", "right"].map((a) => (
                  <button
                    key={a}
                    className={"es-t" + (elSel.align === a ? " on" : "")}
                    onClick={() => patch(elSel.id, { align: a })}
                    aria-label={"Alinear " + a}
                  >
                    {a === "left" ? "⇤" : a === "center" ? "↔" : "⇥"}
                  </button>
                ))}
                <label className="es-t es-color" title="Color del texto">
                  Texto{" "}
                  <input
                    type="color"
                    value={elSel.color}
                    onChange={(e) => patch(elSel.id, { color: e.target.value })}
                  />
                </label>
              </>
            )}
            {(elSel.type === "rect" || elSel.type === "ellipse") && (
              <label className="es-t es-color" title="Color de relleno">
                Relleno{" "}
                <input type="color" value={elSel.fill} onChange={(e) => patch(elSel.id, { fill: e.target.value })} />
              </label>
            )}
            <button
              className="es-t"
              onClick={() => commit({ t: "el^", sid: slide.id, id: elSel.id, z: "front" })}
              title="Traer al frente"
            >
              ⬆
            </button>
            <button
              className="es-t"
              onClick={() => commit({ t: "el^", sid: slide.id, id: elSel.id, z: "back" })}
              title="Enviar atrás"
            >
              ⬇
            </button>
            <button className="es-t" onClick={duplicar}>
              ⧉ Duplicar
            </button>
            <button className="es-t es-del" onClick={borrar}>
              <IconoEnLinea nombre="basura" />
              Borrar
            </button>
          </>
        )}
        {error && (
          <span className="es-err" role="alert">
            {error}
          </span>
        )}
      </div>

      <div className="es-body">
        {/* Diapositivas */}
        <nav className="es-films" aria-label="Diapositivas">
          {deck.slides.map((s, i) => (
            <div key={s.id} className={"es-film" + (s.id === slide.id ? " on" : "")}>
              <button
                className="es-film-btn"
                onClick={() => {
                  setSlideId(s.id);
                  setSel(null);
                  setEditing(null);
                }}
                aria-label={"Diapositiva " + (i + 1)}
              >
                <span className="es-film-n">{i + 1}</span>
                <SlideView slide={s} width={150} />
                {comments[s.id]?.length > 0 && (
                  <span className="es-film-c" title="Tiene comentarios del docente">
                    <IconoEnLinea nombre="comentario" />
                    {comments[s.id].length}
                  </span>
                )}
              </button>
              {s.id === slide.id && !bloqueado && (
                <div className="es-film-act">
                  <button onClick={() => mover(s, -1)} disabled={i === 0} aria-label="Subir">
                    ↑
                  </button>
                  <button onClick={() => mover(s, 1)} disabled={i === deck.slides.length - 1} aria-label="Bajar">
                    ↓
                  </button>
                  <button onClick={() => duplicarDiapositiva(s)} aria-label="Duplicar diapositiva">
                    ⧉
                  </button>
                  <button
                    onClick={() => borrarDiapositiva(s)}
                    disabled={deck.slides.length <= 1}
                    aria-label="Borrar diapositiva"
                  >
                    <IconoEnLinea nombre="basura" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {!bloqueado && (
            <div className="es-nueva">
              <Button
                size="sm"
                onClick={() => setMenuNueva(!menuNueva)}
                disabled={deck.slides.length >= LIMITES.slides}
              >
                ＋ Diapositiva
              </Button>
              {menuNueva && (
                <div className="es-menu" role="menu">
                  {PLANTILLAS.map(([id, nombre]) => (
                    <button key={id} role="menuitem" onClick={() => nuevaDiapositiva(id)}>
                      {nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Lienzo */}
        <main
          className="es-stage"
          ref={stageBox}
          onPointerDown={() => {
            document.activeElement?.blur?.();
            setSel(null);
            setEditing(null);
          }}
        >
          <div className="es-canvas-wrap" style={{ width: W * escala, height: H * escala }}>
            <div
              className="es-canvas"
              style={{ width: W, height: H, transform: `scale(${escala})`, background: slide.bg }}
            >
              {slide.elements.map((el) => {
                const activo = sel === el.id && !bloqueado;
                return (
                  <div
                    key={el.id}
                    className={"es-el" + (activo ? " sel" : "") + (bloqueado ? " ro" : "")}
                    style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
                    onPointerDown={(e) => empezar(e, el, "mover")}
                    onDoubleClick={() => !bloqueado && el.type === "text" && setEditing(el.id)}
                  >
                    {editing === el.id ? (
                      <textarea
                        className="es-edit"
                        autoFocus
                        defaultValue={el.text}
                        maxLength={LIMITES.texto}
                        style={{
                          fontSize: el.size,
                          color: el.color,
                          fontWeight: el.bold ? 800 : 500,
                          fontStyle: el.italic ? "italic" : "normal",
                          textDecoration: el.underline ? "underline" : "none",
                          textAlign: el.align,
                        }}
                        onFocus={(e) => e.target.select()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          const m = e.ctrlKey || e.metaKey;
                          const k = e.key.toLowerCase();
                          if (e.key === "Escape" || (m && e.key === "Enter")) e.currentTarget.blur();
                          else if (m && !e.shiftKey && k === "b") {
                            e.preventDefault();
                            patch(el.id, { bold: !el.bold });
                          } else if (m && !e.shiftKey && k === "i") {
                            e.preventDefault();
                            patch(el.id, { italic: !el.italic });
                          } else if (m && !e.shiftKey && k === "u") {
                            e.preventDefault();
                            patch(el.id, { underline: !el.underline });
                          } else if (m && e.shiftKey && k === "l") {
                            e.preventDefault();
                            patch(el.id, { align: "left" });
                          } else if (m && e.shiftKey && k === "e") {
                            e.preventDefault();
                            patch(el.id, { align: "center" });
                          } else if (m && e.shiftKey && k === "r") {
                            e.preventDefault();
                            patch(el.id, { align: "right" });
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value !== el.text) patch(el.id, { text: e.target.value });
                          setEditing(null);
                        }}
                      />
                    ) : (
                      <ElementoVista el={{ ...el, x: 0, y: 0 }} />
                    )}
                    {activo && editing !== el.id && (
                      <span
                        className="es-handle"
                        style={{ transform: `scale(${1 / escala})` }}
                        onPointerDown={(e) => empezar(e, el, "tamano")}
                        aria-label="Cambiar tamaño"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* Panel derecho */}
        <aside className="es-side">
          {typeof sidebar === "function" ? sidebar(slide) : sidebar}
          <h3>
            <IconoEnLinea nombre="comentario" />
            Comentarios del docente
          </h3>
          {coments.length === 0 ? (
            <p className="es-muted">Aún no hay comentarios en esta diapositiva.</p>
          ) : (
            <ul className="es-coms">
              {coments.map((c, i) => (
                <li key={i}>
                  {c.text}
                  <small>{new Date(c.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------- modo presentación a pantalla completa ----------
function Presentar({ deck, inicio, onSalir }) {
  const total = deck.slides.length;
  const [i, setI] = useState(Math.max(0, Math.min(total - 1, inicio)));
  const [pantalla, setPantalla] = useState(null); // null | "negra" | "blanca"
  const [num, setNum] = useState(""); // número escrito para saltar a una diapositiva
  const numRef = useRef("");
  const [ancho, setAncho] = useState(window.innerWidth);
  const ref = useRef(null);
  const ir = (n) => {
    setPantalla(null);
    setI(Math.max(0, Math.min(total - 1, n)));
  };
  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    const onResize = () => setAncho(window.innerWidth);
    const poner = (v) => {
      numRef.current = v;
      setNum(v);
    };
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === "Escape") onSalir();
      else if (/^[0-9]$/.test(e.key)) {
        poner((numRef.current + e.key).slice(0, 3));
      } else if (e.key === "Enter" && numRef.current) {
        const n = Number(numRef.current) - 1;
        poner("");
        ir(n);
      } else if (["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"].includes(e.key) || k === "n") {
        e.preventDefault();
        poner("");
        setPantalla(null);
        setI((n) => Math.min(total - 1, n + 1));
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key) || k === "p") {
        e.preventDefault();
        poner("");
        setPantalla(null);
        setI((n) => Math.max(0, n - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        ir(0);
      } else if (e.key === "End") {
        e.preventDefault();
        ir(total - 1);
      } else if (k === "b" || e.key === ".") setPantalla((p) => (p === "negra" ? null : "negra"));
      else if (k === "w" || e.key === ",") setPantalla((p) => (p === "blanca" ? null : "blanca"));
    };
    const onFs = () => {
      if (!document.fullscreenElement) onSalir();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []); // eslint-disable-line
  const w = Math.min(ancho, (window.innerHeight * W) / H);
  return (
    <div
      className="es-pres"
      ref={ref}
      onClick={() => {
        setNum("");
        numRef.current = "";
        setPantalla(null);
        setI((n) => Math.min(total - 1, n + 1));
      }}
    >
      {pantalla ? (
        <div
          className={"es-pres-tapa " + pantalla}
          aria-label={pantalla === "negra" ? "Pantalla en negro" : "Pantalla en blanco"}
        />
      ) : (
        <SlideView slide={deck.slides[i]} width={w} />
      )}
      {num && (
        <div className="es-pres-num" role="status">
          Ir a la diapositiva: <b>{num}</b> <small>(Enter)</small>
        </div>
      )}
      <div className="es-pres-bar" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => ir(i - 1)} disabled={i === 0} aria-label="Anterior">
          ◀
        </button>
        <span>
          {i + 1} / {total}
        </span>
        <button onClick={() => ir(i + 1)} disabled={i === total - 1} aria-label="Siguiente">
          ▶
        </button>
        <button onClick={onSalir}>✕ Salir</button>
      </div>
    </div>
  );
}

// ---------- panel de atajos de teclado ----------
const GRUPOS_ATAJOS = [
  [
    "General",
    [
      ["Ctrl + Z", "Deshacer"],
      ["Ctrl + Y  ·  Ctrl + Shift + Z", "Rehacer"],
      ["Ctrl + C  ·  Ctrl + X  ·  Ctrl + V", "Copiar, cortar y pegar (también imágenes y texto de otras páginas)"],
      ["Ctrl + D", "Duplicar el elemento (o la diapositiva si no hay uno elegido)"],
      ["Supr  ·  Retroceso", "Borrar el elemento elegido"],
      ["Tab  ·  Shift + Tab", "Elegir el siguiente / anterior elemento"],
      ["Esc", "Quitar la selección"],
      ["Ctrl + S", "Guardar (es automático)"],
      ["?  ·  Ctrl + /", "Abrir o cerrar esta ayuda"],
    ],
  ],
  [
    "Insertar",
    [
      ["T", "Cuadro de texto"],
      ["R", "Cuadro (rectángulo)"],
      ["C", "Círculo"],
      ["Ctrl + V", "Pegar una imagen copiada"],
      ["Ctrl + M", "Nueva diapositiva"],
    ],
  ],
  [
    "Texto",
    [
      ["Enter  ·  F2  ·  doble clic", "Escribir en el texto elegido"],
      ["Esc  ·  Ctrl + Enter", "Terminar de escribir"],
      ["Ctrl + B", "Negrita"],
      ["Ctrl + I", "Cursiva"],
      ["Ctrl + U", "Subrayado"],
      ["Ctrl + Shift + L  /  E  /  R", "Alinear a la izquierda / centro / derecha"],
      ["Ctrl + Shift + >  ·  Ctrl + ]", "Letra más grande"],
      ["Ctrl + Shift + <  ·  Ctrl + [", "Letra más pequeña"],
    ],
  ],
  [
    "Mover y ordenar",
    [
      ["Flechas", "Mover 4 px"],
      ["Shift + flechas", "Mover 20 px"],
      ["Ctrl + Shift + ↑  ·  Ctrl + Shift + ]", "Traer al frente"],
      ["Ctrl + Shift + ↓  ·  Ctrl + Shift + [", "Enviar atrás"],
    ],
  ],
  [
    "Diapositivas",
    [
      ["Re Pág  ·  Av Pág", "Diapositiva anterior / siguiente"],
      ["Flechas (sin elemento elegido)", "Diapositiva anterior / siguiente"],
      ["Inicio  ·  Fin", "Primera / última diapositiva"],
      ["Alt + Shift + ↑  ·  ↓", "Mover la diapositiva hacia arriba / abajo"],
    ],
  ],
  [
    "Presentar",
    [
      ["F5", "Presentar desde el inicio"],
      ["Shift + F5  ·  Ctrl + Enter", "Presentar desde la diapositiva actual"],
      ["→  ↓  Espacio  Enter  N", "Siguiente"],
      ["←  ↑  Retroceso  P", "Anterior"],
      ["Número + Enter", "Ir a esa diapositiva"],
      ["B  ·  .", "Pantalla en negro (otra vez para volver)"],
      ["W  ·  ,", "Pantalla en blanco (otra vez para volver)"],
      ["Esc", "Salir de la presentación"],
    ],
  ],
];

function Atajos({ onCerrar }) {
  return (
    <div className="es-atajos-bg" onClick={onCerrar}>
      <div
        className="es-atajos"
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="es-atajos-head">
          <h2>⌨ Atajos de teclado</h2>
          <Button variant="ghost" size="sm" onClick={onCerrar} autoFocus>
            Cerrar
          </Button>
        </div>
        <p className="es-muted">
          En Mac usa ⌘ en lugar de Ctrl. Funcionan cuando no estás escribiendo dentro de un texto.
        </p>
        <div className="es-atajos-grid">
          {GRUPOS_ATAJOS.map(([titulo, filas]) => (
            <section key={titulo}>
              <h3>{titulo}</h3>
              <ul>
                {filas.map(([teclas, que]) => (
                  <li key={teclas + que}>
                    <kbd>{teclas}</kbd>
                    <span>{que}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
