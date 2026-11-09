import { useEffect, useRef, useState } from "react";
import { Brand } from "./Brand";
import { CONFIG, TAU, FORMAS, CON_RELLENO, NOMBRES_HERR, NOMBRES_OBJ, AYUDA } from "./pizarra/config";
import { uid, fondoDe, colorReal, hoy, medidaForma } from "./pizarra/utils";
import { Icono } from "./pizarra/Iconos";
import { medirTexto, cajaDe, toca, mover, restringir } from "./pizarra/geometria";
import { dibujarEscena } from "./pizarra/dibujo";
import { paginaNueva, cargar } from "./pizarra/estado";
import { renderPagina, aBlob, bajar, crearPDF } from "./pizarra/exportar";
import { DialogoDescarga, muestraFondo } from "./pizarra/DialogoDescarga";
import { Btn } from "./pizarra/Btn";
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
