import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { W, H, LIMITES, aplicarOp, diapositiva, elementoForma, elementoImagen, elementoTexto, nuevoId } from "./model";
import { ElementoVista, SlideView } from "./SlideView";

// ---------- utilidades ----------
function inverso(deck, op) {
  const slide = deck.slides.find((s) => s.id === op.sid);
  const el = slide?.elements.find((e) => e.id === op.id || e.id === op.el?.id);
  switch (op.t) {
    case "el+": return el ? { t: "el+", sid: op.sid, el } : { t: "el-", sid: op.sid, id: op.el.id };
    case "el-": return el ? { t: "el+", sid: op.sid, el } : null;
    case "el~": {
      if (!el) return null;
      const prev = {};
      for (const k of Object.keys(op.patch)) prev[k] = el[k];
      return { t: "el~", sid: op.sid, id: op.id, patch: prev };
    }
    case "slide+": return { t: "slide-", id: op.slide.id };
    case "slide-": { const i = deck.slides.findIndex((s) => s.id === op.id); return i < 0 ? null : { t: "slide+", slide: deck.slides[i], index: i }; }
    case "slide~": { const s = deck.slides.find((x) => x.id === op.id); return s ? { t: "slide~", id: op.id, bg: s.bg } : null; }
    case "slide>": { const i = deck.slides.findIndex((s) => s.id === op.id); return i < 0 ? null : { t: "slide>", id: op.id, to: i }; }
    default: return null;
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

const PLANTILLAS = [["blanco", "En blanco"], ["titulo", "Portada"], ["contenido", "Título y texto"]];

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
export function Editor({ deck, setDeck, onOp, readOnly, comments = {}, onView, sidebar, topLeft, topRight, aviso }) {
  const [sel, setSel] = useState(null); // id del elemento seleccionado
  const [editing, setEditing] = useState(null); // id del texto que se está escribiendo
  const [slideId, setSlideId] = useState(deck.slides[0].id);
  const [presentando, setPresentando] = useState(false);
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
  useEffect(() => { if (slide.id !== slideId) setSlideId(slide.id); }, [slide.id, slideId]);
  useEffect(() => { onView?.(slide.id); }, [slide.id]); // eslint-disable-line
  const elSel = slide.elements.find((e) => e.id === sel) || null;
  useEffect(() => { if (sel && !elSel) { setSel(null); setEditing(null); } }, [sel, elSel]);

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
  const commit = useCallback((op, { guardarUndo = true, enviar = true } = {}) => {
    if (readOnly) return;
    const d = deckRef.current;
    if (guardarUndo) {
      const inv = inverso(d, op);
      if (inv) { undo.current.push(inv); if (undo.current.length > 50) undo.current.shift(); setUndoN(undo.current.length); }
    }
    const nuevo = aplicarOp(d, op);
    deckRef.current = nuevo;
    setDeck(nuevo);
    if (enviar) onOp(op);
  }, [readOnly, setDeck, onOp]);

  const deshacer = () => {
    const inv = undo.current.pop();
    setUndoN(undo.current.length);
    if (inv) commit(inv, { guardarUndo: false });
  };

  // ---- acciones ----
  const addEl = (el, editar = false) => { commit({ t: "el+", sid: slide.id, el }); setSel(el.id); setEditing(editar ? el.id : null); };
  const patch = (id, p, opts) => commit({ t: "el~", sid: slide.id, id, patch: p }, opts);
  const borrar = () => { if (elSel) { commit({ t: "el-", sid: slide.id, id: elSel.id }); setSel(null); } };
  const duplicar = () => { if (elSel) addEl({ ...elSel, id: nuevoId(), x: elSel.x + 24, y: elSel.y + 24 }); };

  const nuevaDiapositiva = (plantilla) => {
    const s = diapositiva(plantilla);
    const i = deck.slides.findIndex((x) => x.id === slide.id) + 1;
    commit({ t: "slide+", slide: s, index: i });
    setSlideId(s.id); setSel(null); setMenuNueva(false);
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

  // ---- teclado ----
  useEffect(() => {
    function onKey(e) {
      if (presentando) return;
      const enCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !enCampo) { e.preventDefault(); deshacer(); return; }
      if (enCampo || readOnly || !elSel) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); borrar(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicar(); }
      else if (e.key === "Enter" && elSel.type === "text") { e.preventDefault(); setEditing(elSel.id); }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const p = e.shiftKey ? 20 : 4;
        patch(elSel.id, { x: elSel.x + (e.key === "ArrowRight" ? p : e.key === "ArrowLeft" ? -p : 0), y: elSel.y + (e.key === "ArrowDown" ? p : e.key === "ArrowUp" ? -p : 0) }, { guardarUndo: false });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
      const dx = (ev.clientX - ini.px) / escala, dy = (ev.clientY - ini.py) / escala;
      if (!ini.mov && Math.hypot(dx, dy) < 3) return;
      ini.mov = true;
      let p;
      if (modo === "mover") p = { x: Math.round(ini.x + dx), y: Math.round(ini.y + dy) };
      else {
        const w = Math.max(30, Math.round(ini.w + dx));
        p = el.type === "image" ? { w, h: Math.round((w * ini.h) / ini.w) } : { w, h: Math.max(30, Math.round(ini.h + dy)) };
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
      {presentando && <Presentar deck={deck} inicio={deck.slides.findIndex((s) => s.id === slide.id)} onSalir={() => setPresentando(false)} />}
      <header className="es-top">
        <div className="es-top-l">{topLeft}</div>
        <div className="es-top-r">
          {topRight}
          <button className="es-btn" onClick={() => setPresentando(true)}>▶ Presentar</button>
        </div>
      </header>
      {aviso && <div className="es-aviso">{aviso}</div>}

      {/* Barra de herramientas */}
      <div className="es-tools" role="toolbar" aria-label="Herramientas">
        <button className="es-t" disabled={bloqueado} onClick={() => addEl(elementoTexto(), true)}>Aa Texto</button>
        <button className="es-t" disabled={bloqueado} onClick={() => addEl(elementoForma("rect"))}>▭ Cuadro</button>
        <button className="es-t" disabled={bloqueado} onClick={() => addEl(elementoForma("ellipse", { w: 200, h: 200 }))}>◯ Círculo</button>
        <button className="es-t" disabled={bloqueado} onClick={() => fileRef.current?.click()}>🖼 Imagen</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={subirImagen} />
        <span className="es-sep" />
        <button className="es-t" disabled={bloqueado || !undoN} onClick={deshacer} title="Ctrl + Z">↶ Deshacer</button>
        <label className="es-t es-color" title="Color de fondo de la diapositiva">
          Fondo <input type="color" disabled={bloqueado} value={slide.bg} onChange={(e) => commit({ t: "slide~", id: slide.id, bg: e.target.value })} />
        </label>
        {elSel && !bloqueado && (
          <>
            <span className="es-sep" />
            {elSel.type === "text" && (
              <>
                <button className="es-t" onClick={() => patch(elSel.id, { size: Math.max(8, elSel.size - 4) })} aria-label="Letra más pequeña">A−</button>
                <span className="es-num">{elSel.size}</span>
                <button className="es-t" onClick={() => patch(elSel.id, { size: Math.min(200, elSel.size + 4) })} aria-label="Letra más grande">A+</button>
                <button className={"es-t" + (elSel.bold ? " on" : "")} onClick={() => patch(elSel.id, { bold: !elSel.bold })}><b>N</b></button>
                {["left", "center", "right"].map((a) => (
                  <button key={a} className={"es-t" + (elSel.align === a ? " on" : "")} onClick={() => patch(elSel.id, { align: a })} aria-label={"Alinear " + a}>{a === "left" ? "⇤" : a === "center" ? "↔" : "⇥"}</button>
                ))}
                <label className="es-t es-color" title="Color del texto">Texto <input type="color" value={elSel.color} onChange={(e) => patch(elSel.id, { color: e.target.value })} /></label>
              </>
            )}
            {(elSel.type === "rect" || elSel.type === "ellipse") && (
              <label className="es-t es-color" title="Color de relleno">Relleno <input type="color" value={elSel.fill} onChange={(e) => patch(elSel.id, { fill: e.target.value })} /></label>
            )}
            <button className="es-t" onClick={() => commit({ t: "el^", sid: slide.id, id: elSel.id, z: "front" })} title="Traer al frente">⬆</button>
            <button className="es-t" onClick={() => commit({ t: "el^", sid: slide.id, id: elSel.id, z: "back" })} title="Enviar atrás">⬇</button>
            <button className="es-t" onClick={duplicar}>⧉ Duplicar</button>
            <button className="es-t es-del" onClick={borrar}>🗑 Borrar</button>
          </>
        )}
        {error && <span className="es-err" role="alert">{error}</span>}
      </div>

      <div className="es-body">
        {/* Diapositivas */}
        <nav className="es-films" aria-label="Diapositivas">
          {deck.slides.map((s, i) => (
            <div key={s.id} className={"es-film" + (s.id === slide.id ? " on" : "")}>
              <button className="es-film-btn" onClick={() => { setSlideId(s.id); setSel(null); setEditing(null); }} aria-label={"Diapositiva " + (i + 1)}>
                <span className="es-film-n">{i + 1}</span>
                <SlideView slide={s} width={150} />
                {comments[s.id]?.length > 0 && <span className="es-film-c" title="Tiene comentarios del docente">💬 {comments[s.id].length}</span>}
              </button>
              {s.id === slide.id && !bloqueado && (
                <div className="es-film-act">
                  <button onClick={() => mover(s, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                  <button onClick={() => mover(s, 1)} disabled={i === deck.slides.length - 1} aria-label="Bajar">↓</button>
                  <button onClick={() => duplicarDiapositiva(s)} aria-label="Duplicar diapositiva">⧉</button>
                  <button onClick={() => borrarDiapositiva(s)} disabled={deck.slides.length <= 1} aria-label="Borrar diapositiva">🗑</button>
                </div>
              )}
            </div>
          ))}
          {!bloqueado && (
            <div className="es-nueva">
              <button className="es-btn" onClick={() => setMenuNueva(!menuNueva)} disabled={deck.slides.length >= LIMITES.slides}>＋ Diapositiva</button>
              {menuNueva && (
                <div className="es-menu" role="menu">
                  {PLANTILLAS.map(([id, nombre]) => <button key={id} role="menuitem" onClick={() => nuevaDiapositiva(id)}>{nombre}</button>)}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Lienzo */}
        <main className="es-stage" ref={stageBox} onPointerDown={() => { document.activeElement?.blur?.(); setSel(null); setEditing(null); }}>
          <div className="es-canvas-wrap" style={{ width: W * escala, height: H * escala }}>
            <div className="es-canvas" style={{ width: W, height: H, transform: `scale(${escala})`, background: slide.bg }}>
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
                        style={{ fontSize: el.size, color: el.color, fontWeight: el.bold ? 800 : 500, textAlign: el.align }}
                        onFocus={(e) => e.target.select()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") e.currentTarget.blur(); }}
                        onBlur={(e) => { if (e.target.value !== el.text) patch(el.id, { text: e.target.value }); setEditing(null); }}
                      />
                    ) : (
                      <ElementoVista el={{ ...el, x: 0, y: 0 }} />
                    )}
                    {activo && editing !== el.id && (
                      <span className="es-handle" style={{ transform: `scale(${1 / escala})` }} onPointerDown={(e) => empezar(e, el, "tamano")} aria-label="Cambiar tamaño" />
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
          <h3>💬 Comentarios del docente</h3>
          {coments.length === 0 ? <p className="es-muted">Aún no hay comentarios en esta diapositiva.</p> : (
            <ul className="es-coms">{coments.map((c, i) => <li key={i}>{c.text}<small>{new Date(c.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></li>)}</ul>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------- modo presentación a pantalla completa ----------
function Presentar({ deck, inicio, onSalir }) {
  const [i, setI] = useState(Math.max(0, inicio));
  const [ancho, setAncho] = useState(window.innerWidth);
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    const onResize = () => setAncho(window.innerWidth);
    const onKey = (e) => {
      if (e.key === "Escape") onSalir();
      else if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) setI((n) => Math.min(deck.slides.length - 1, n + 1));
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) setI((n) => Math.max(0, n - 1));
    };
    const onFs = () => { if (!document.fullscreenElement) onSalir(); };
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
    <div className="es-pres" ref={ref} onClick={() => setI((n) => Math.min(deck.slides.length - 1, n + 1))}>
      <SlideView slide={deck.slides[i]} width={w} />
      <div className="es-pres-bar" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0} aria-label="Anterior">◀</button>
        <span>{i + 1} / {deck.slides.length}</span>
        <button onClick={() => setI((n) => Math.min(deck.slides.length - 1, n + 1))} disabled={i === deck.slides.length - 1} aria-label="Siguiente">▶</button>
        <button onClick={onSalir}>✕ Salir</button>
      </div>
    </div>
  );
}
