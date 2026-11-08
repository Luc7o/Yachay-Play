import React, { useEffect, useRef, useState } from "react";
import { Brand } from "./Brand";
import { prepararAudio, nota } from "./herramientasAudio";
import "./herramientas.css";

// ============================================================================
// RULETA DE SORTEOS
// ============================================================================
// Sirve para sortear cualquier cosa (alumnos, temas, preguntas, grupos...).
// - Varias listas con nombre, guardadas en este navegador (sin cuenta).
// - La ruleta se dibuja en un <canvas> y gira con desaceleración.
// - "Repartir" asigna al azar los elementos de una lista entre los de otra.
//
// Lo más fácil de personalizar está en CONFIG (abajo).
// ============================================================================

const CONFIG = {
  // Imágenes de la mascota (rutas dentro de frontend/public/)
  mascota: { espera: "/mascota-explica.png", ganador: "/mascota-gana.png" },

  // Colores de los segmentos: tonos suaves de la paleta de la marca. El color del
  // texto (blanco u oscuro) se elige solo para que siempre se lea bien.
  paleta: ["#023A73", "#FBC8A0", "#2B6AA8", "#DCE8F5", "#0A4C8F", "#F7B07A", "#6D9BC9", "#FFE2C8"],
  textoOscuro: "#012A55",
  aro: "#023A73", // borde exterior de la ruleta
  centro: "#023A73",
  flecha: "#F16503",

  segundosDeGiro: 5,
  maxElementos: 300, // límite por lista, para que la ruleta siga legible
  esperaAntesDeQuitar: 1500, // ms que se ve al ganador en la ruleta antes de quitarlo

  // Listas de ejemplo (solo la primera vez que se abre; se pueden borrar)
  listasDeEjemplo: [
    { nombre: "Alumnos", items: ["Ana", "Beto", "Carla", "Diego", "Elena", "Fabián", "Gabriela", "Hugo"] },
    { nombre: "Temas", items: ["Introducción", "Ejemplos", "Ventajas", "Desventajas"] },
  ],
  clave: "yachayplay.ruleta.v1",
};

const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const uid = () => "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Número al azar entre 0 y 1 (criptográfico si el navegador lo tiene)
function azar() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  } catch {
    return Math.random();
  }
}
const azarEntero = (n) => Math.floor(azar() * n);
function mezclar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = azarEntero(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const leerLineas = (texto) =>
  String(texto)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, CONFIG.maxElementos);

// ---------------- Guardado en este navegador ----------------
function cargar() {
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem(CONFIG.clave) || "null");
  } catch {
    /* sin datos guardados */
  }
  let listas = [];
  if (d && Array.isArray(d.listas)) {
    listas = d.listas
      .filter((l) => l && typeof l.id === "string" && Array.isArray(l.items))
      .map((l) => ({ id: l.id, nombre: String(l.nombre || "Lista").slice(0, 40), items: l.items.map(String).slice(0, CONFIG.maxElementos) }));
  }
  if (!listas.length) listas = CONFIG.listasDeEjemplo.map((s) => ({ id: uid(), nombre: s.nombre, items: [...s.items] }));
  const activa = listas.some((l) => l.id === d?.activa) ? d.activa : listas[0].id;
  return { listas, activa, quitar: d?.quitar !== false, sonido: d?.sonido !== false, mascota: d?.mascota !== false };
}

// ---------------- Colores ----------------
function luminancia(hex) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const colorDeTexto = (fondo) => (contraste(fondo, "#FFFFFF") >= contraste(fondo, CONFIG.textoOscuro) ? "#FFFFFF" : CONFIG.textoOscuro);
export function colorDeSegmento(i, n) {
  const p = CONFIG.paleta;
  let c = p[i % p.length];
  if (n > 1 && i === n - 1 && c === p[0]) c = p[(i + 1) % p.length]; // que el último no sea igual al primero
  return c;
}

// ============================================================================
// DIBUJO Y MATEMÁTICA DE LA RULETA
// El segmento 0 empieza arriba (en la flecha) y los demás siguen en sentido
// horario. La rueda gira "giro" radianes en sentido horario; la flecha está
// arriba, así que apunta al ángulo (-giro) de la rueda.
// ============================================================================

// ¿Qué segmento queda bajo la flecha con un giro dado? (misma matemática que el dibujo)
export function segmentoBajoLaFlecha(giro, n) {
  if (n <= 0) return -1;
  return Math.min(n - 1, Math.floor(mod(-giro, TAU) / (TAU / n)));
}

function ajustarTexto(ctx, texto, anchoMax, tamMax, tamMin, fuente) {
  let tam = tamMax;
  ctx.font = `800 ${tam}px ${fuente}`;
  while (tam > tamMin && ctx.measureText(texto).width > anchoMax) {
    tam -= 1;
    ctx.font = `800 ${tam}px ${fuente}`;
  }
  let t = texto;
  while (t.length > 1 && ctx.measureText(t).width > anchoMax) t = t.slice(0, -1);
  if (t !== texto) t = t.replace(/\s+$/, "") + "…";
  return { texto: t, tam };
}

export function dibujarRuleta(canvas, items, giro, resaltado) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const lado = Math.max(200, Math.round(canvas.clientWidth * dpr));
  if (canvas.width !== lado || canvas.height !== lado) {
    canvas.width = lado;
    canvas.height = lado;
  }
  const W = lado;
  const n = items.length;
  const margenFlecha = W * 0.07;
  const R = W / 2 - margenFlecha - W * 0.012; // radio de la rueda (deja sitio para la flecha)
  const cx = W / 2;
  const cy = W / 2 + margenFlecha * 0.35;
  const fuente = getComputedStyle(canvas).fontFamily || "sans-serif";
  ctx.clearRect(0, 0, W, W);

  // aro exterior con sombra suave
  ctx.save();
  ctx.shadowColor = "rgba(1,42,85,.22)";
  ctx.shadowBlur = W * 0.02;
  ctx.shadowOffsetY = W * 0.006;
  ctx.beginPath();
  ctx.arc(cx, cy, R + W * 0.014, 0, TAU);
  ctx.fillStyle = CONFIG.aro;
  ctx.fill();
  ctx.restore();

  if (n === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = "#E6EEF7";
    ctx.fill();
    ctx.fillStyle = CONFIG.aro;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${W * 0.05}px ${fuente}`;
    ctx.fillText("Sin elementos", cx, cy - W * 0.02);
    ctx.font = `700 ${W * 0.03}px ${fuente}`;
    ctx.fillText("Agrega nombres a la lista", cx, cy + W * 0.035);
  } else {
    const seg = TAU / n;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + giro + i * seg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a0 + seg);
      ctx.closePath();
      ctx.fillStyle = colorDeSegmento(i, n);
      ctx.fill();
      if (n > 1) {
        ctx.lineWidth = Math.max(1, W * 0.003);
        ctx.strokeStyle = "rgba(255,255,255,.9)";
        ctx.stroke();
      }
    }
    // nombres: el tamaño de letra se ajusta a la cantidad de elementos
    for (let j = 0; j < n; j++) {
      const medio = -Math.PI / 2 + giro + j * seg + seg / 2;
      const fondo = colorDeSegmento(j, n);
      const color = colorDeTexto(fondo);
      const altoDisponible = seg >= Math.PI ? R * 0.3 : 2 * Math.sin(seg / 2) * R * 0.55 * 0.82;
      const tamMax = Math.max(9, Math.min(R * 0.14, altoDisponible));
      const ajuste = ajustarTexto(ctx, String(items[j]), R * 0.7, tamMax, Math.max(8, W * 0.014), fuente);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(medio);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${ajuste.tam}px ${fuente}`;
      ctx.lineJoin = "round";
      if (color === "#FFFFFF") {
        ctx.lineWidth = ajuste.tam * 0.14;
        ctx.strokeStyle = "rgba(1,42,85,.4)";
        ctx.strokeText(ajuste.texto, R * 0.94, 0);
      }
      ctx.fillStyle = color;
      ctx.fillText(ajuste.texto, R * 0.94, 0);
      ctx.restore();
    }
    // contorno del ganador
    if (resaltado >= 0 && resaltado < n) {
      const h0 = -Math.PI / 2 + giro + resaltado * seg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, h0, h0 + seg);
      ctx.closePath();
      ctx.lineJoin = "round";
      ctx.lineWidth = W * 0.012;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
      ctx.lineWidth = W * 0.004;
      ctx.strokeStyle = CONFIG.flecha;
      ctx.stroke();
    }
  }

  // centro
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.09, 0, TAU);
  ctx.fillStyle = CONFIG.centro;
  ctx.fill();
  ctx.lineWidth = W * 0.007;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  // flecha indicadora (arriba, apunta hacia la rueda)
  const punta = cy - R + W * 0.03;
  const mitad = W * 0.04;
  const tope = punta - W * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx, punta);
  ctx.lineTo(cx - mitad, tope);
  ctx.lineTo(cx + mitad, tope);
  ctx.closePath();
  ctx.fillStyle = CONFIG.flecha;
  ctx.fill();
  ctx.lineWidth = W * 0.007;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineJoin = "round";
  ctx.stroke();
}

// ============================================================================
// COMPONENTE
// ============================================================================
export function Ruleta({ goHome }) {
  const inicial = useRef(null);
  if (!inicial.current) inicial.current = cargar();

  const [listas, setListas] = useState(inicial.current.listas);
  const [activaId, setActivaId] = useState(inicial.current.activa);
  const [quitar, setQuitar] = useState(inicial.current.quitar);
  const [sonido, setSonido] = useState(inicial.current.sonido);
  const [mascota, setMascota] = useState(inicial.current.mascota);
  const [pestana, setPestana] = useState("ruleta"); // ruleta | repartir
  const [soloRuleta, setSoloRuleta] = useState(false); // true = oculta las listas para proyectar

  // Lo que hay AHORA en la ruleta (copia de trabajo de cada lista) y lo que va saliendo
  const [pools, setPools] = useState(() => Object.fromEntries(inicial.current.listas.map((l) => [l.id, [...l.items]])));
  const [historiales, setHistoriales] = useState({});
  const [borrador, setBorrador] = useState(() => inicial.current.listas.find((l) => l.id === inicial.current.activa).items.join("\n"));
  const [resultado, setResultado] = useState({ etiqueta: "Resultado", texto: "Pulsa «Girar»", clave: 0, gano: false });
  const [ocupada, setOcupada] = useState(false); // true mientras gira
  const [resaltado, setResaltado] = useState(-1);

  const activa = listas.find((l) => l.id === activaId) || listas[0];
  const pool = pools[activa.id] || [];
  const historial = historiales[activa.id] || [];

  const poolsRef = useRef(pools); // copia siempre actual (para leerla dentro de temporizadores)
  poolsRef.current = pools;
  const activaRef = useRef(activa.id);
  activaRef.current = activa.id;
  const canvasRef = useRef(null);
  const giroRef = useRef(0); // ángulo actual de la rueda
  const animRef = useRef(0);
  const temporizadores = useRef([]);
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;
  const reducirMovimiento = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const tic = () => sonidoRef.current && nota(1400, 0, 0.03, 0.1, "square");
  const campanilla = () => {
    if (!sonidoRef.current) return;
    nota(659, 0, 0.22, 0.3);
    nota(880, 0.16, 0.22, 0.3);
    nota(1175, 0.32, 0.45, 0.35);
  };

  // Guardar en este navegador
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG.clave, JSON.stringify({ listas, activa: activaId, quitar, sonido, mascota }));
    } catch {
      /* si el navegador no deja guardar, no pasa nada */
    }
  }, [listas, activaId, quitar, sonido, mascota]);

  // Redibujar cuando cambie la lista, el ganador resaltado, la pestaña o el tamaño
  useEffect(() => {
    if (pestana !== "ruleta") return undefined;
    const pintar = () => dibujarRuleta(canvasRef.current, pool, giroRef.current, resaltado);
    pintar();
    let obs = null;
    if (window.ResizeObserver && canvasRef.current) {
      obs = new ResizeObserver(pintar);
      obs.observe(canvasRef.current);
    }
    window.addEventListener("resize", pintar);
    return () => {
      if (obs) obs.disconnect();
      window.removeEventListener("resize", pintar);
    };
  }, [pool, resaltado, pestana, soloRuleta]);

  // Al salir de la pantalla se cancela cualquier giro o espera pendiente
  useEffect(
    () => () => {
      cancelAnimationFrame(animRef.current);
      temporizadores.current.forEach(clearTimeout);
    },
    []
  );

  // ---------------- Listas ----------------
  function poner(id, items) {
    setPools((p) => ({ ...p, [id]: items }));
    setBorrador(items.join("\n"));
  }
  function reiniciarResultado() {
    setResultado({ etiqueta: "Resultado", texto: "Pulsa «Girar»", clave: Date.now(), gano: false });
    setResaltado(-1);
  }
  function cambiarLista(id) {
    setActivaId(id);
    setBorrador((pools[id] || []).join("\n"));
    reiniciarResultado();
  }
  function nuevaLista() {
    const l = { id: uid(), nombre: `Lista ${listas.length + 1}`, items: [] };
    setListas([...listas, l]);
    setPools((p) => ({ ...p, [l.id]: [] }));
    setActivaId(l.id);
    setBorrador("");
    reiniciarResultado();
  }
  function borrarLista() {
    if (!window.confirm(`¿Borrar la lista «${activa.nombre}»? No se puede deshacer.`)) return;
    let resto = listas.filter((l) => l.id !== activa.id);
    if (!resto.length) {
      const l = { id: uid(), nombre: "Lista 1", items: [] };
      resto = [l];
      setPools((p) => ({ ...p, [l.id]: [] }));
    }
    setListas(resto);
    setActivaId(resto[0].id);
    setBorrador((pools[resto[0].id] || resto[0].items).join("\n"));
    reiniciarResultado();
  }
  function renombrar(nombre) {
    setListas(listas.map((l) => (l.id === activa.id ? { ...l, nombre: nombre.slice(0, 40) } : l)));
  }
  // Lo que el docente escribe es la lista GUARDADA y también lo que hay en la ruleta
  function editarElementos(texto) {
    const items = leerLineas(texto);
    setBorrador(texto);
    setListas(listas.map((l) => (l.id === activa.id ? { ...l, items } : l)));
    setPools((p) => ({ ...p, [activa.id]: [...items] }));
    setResaltado(-1);
  }
  function mezclarLista() {
    poner(activa.id, mezclar(pool));
    setResaltado(-1);
  }
  function restaurarLista() {
    poner(activa.id, [...activa.items]);
    setHistoriales((h) => ({ ...h, [activa.id]: [] }));
    reiniciarResultado();
  }

  // ============================================================================
  // GIRO
  // El ganador se sortea ANTES de girar y se calcula el ángulo exacto en que la
  // flecha quedará dentro de su segmento. Al terminar, el resultado se vuelve a
  // leer de dónde quedó la flecha: lo que ves es lo que sale.
  // ============================================================================
  function girar() {
    const n = pool.length;
    if (ocupada || n === 0) return;
    prepararAudio();
    const id = activa.id;
    const items = [...pool];
    setOcupada(true);
    setResaltado(-1);
    setResultado({ etiqueta: "Girando…", texto: "🎡", clave: Date.now(), gano: false });

    const seg = TAU / n;
    const elegido = azarEntero(n);
    const dentro = 0.15 + 0.7 * azar(); // evita caer justo en el borde de un segmento
    const objetivoEnRueda = (elegido + dentro) * seg;
    const desde = giroRef.current;
    const falta = mod(-objetivoEnRueda - desde, TAU);
    const vueltas = reducirMovimiento ? 0 : 5 + azarEntero(3);
    const hasta = desde + falta + vueltas * TAU;
    const duracion = reducirMovimiento ? 500 : CONFIG.segundosDeGiro * 1000;
    const t0 = performance.now();
    let ultimo = segmentoBajoLaFlecha(desde, n);
    let ultimoTic = 0;

    const cuadro = (ahora) => {
      const p = Math.min(1, (ahora - t0) / duracion);
      const suave = 1 - Math.pow(1 - p, 4); // desaceleración
      giroRef.current = desde + (hasta - desde) * suave;
      const actual = segmentoBajoLaFlecha(giroRef.current, n);
      if (actual !== ultimo) {
        ultimo = actual;
        if (ahora - ultimoTic > 45) {
          tic();
          ultimoTic = ahora;
        }
      }
      dibujarRuleta(canvasRef.current, items, giroRef.current, -1);
      if (p < 1) animRef.current = requestAnimationFrame(cuadro);
      else terminar(id, items);
    };
    animRef.current = requestAnimationFrame(cuadro);
  }

  function terminar(id, items) {
    giroRef.current = mod(giroRef.current, TAU);
    const idx = segmentoBajoLaFlecha(giroRef.current, items.length); // resultado leído de dónde quedó la flecha
    const ganador = items[idx];
    setResaltado(idx);
    setResultado({ etiqueta: "¡Salió!", texto: ganador, clave: Date.now(), gano: true });
    setHistoriales((h) => ({ ...h, [id]: [...(h[id] || []), ganador] }));
    campanilla();

    const despues = () => {
      if (quitar) {
        const actual = [...(poolsRef.current[id] || [])];
        if (actual[idx] === ganador) actual.splice(idx, 1);
        setPools((p) => ({ ...p, [id]: actual }));
        if (id === activaRef.current) setBorrador(actual.join("\n"));
        if (items.length === 1) setResultado({ etiqueta: "¡Ya salieron todos!", texto: ganador, clave: Date.now(), gano: true });
      }
      setResaltado(-1);
      setOcupada(false);
    };
    if (quitar) temporizadores.current.push(setTimeout(despues, CONFIG.esperaAntesDeQuitar));
    else despues();
  }
  // ============================================================================
  // REPARTIR UNA LISTA ENTRE OTRA
  // ============================================================================
  const [repartirQue, setRepartirQue] = useState(() => (inicial.current.listas[1] || inicial.current.listas[0]).id);
  const [repartirEntre, setRepartirEntre] = useState(() => inicial.current.listas[0].id);
  const [reparto, setReparto] = useState(null); // { entre, que, filas: [[quien, que, repetido]] }
  const [avisoReparto, setAvisoReparto] = useState("");
  const idsValidos = listas.map((l) => l.id);
  const queId = idsValidos.includes(repartirQue) ? repartirQue : listas[0].id;
  const entreId = idsValidos.includes(repartirEntre) ? repartirEntre : listas[0].id;

  function repartir() {
    const que = listas.find((l) => l.id === queId);
    const entre = listas.find((l) => l.id === entreId);
    setReparto(null);
    if (que.id === entre.id) return setAvisoReparto("Elige dos listas distintas: una para repartir y otra con quienes la reciben.");
    const A = que.items;
    const B = entre.items;
    if (!A.length || !B.length) return setAvisoReparto("Las dos listas necesitan al menos un elemento.");

    let asignados = mezclar(A);
    while (asignados.length < B.length) asignados = asignados.concat(mezclar(A)); // si faltan, se vuelve a repartir
    asignados = asignados.slice(0, B.length);

    if (A.length > B.length) {
      setAvisoReparto(`Sobraron ${plural(A.length - B.length, "elemento", "elementos")} de «${que.nombre}» (había ${A.length} para ${B.length} en «${entre.nombre}»).`);
    } else if (A.length < B.length) {
      setAvisoReparto(`Hay más en «${entre.nombre}» (${B.length}) que elementos en «${que.nombre}» (${A.length}): algunos se repiten (${plural(B.length - A.length, "repetición", "repeticiones")}).`);
    } else {
      setAvisoReparto(`Reparto exacto: cada elemento de «${que.nombre}» le tocó a uno distinto.`);
    }
    const vistos = new Set();
    const filas = B.map((quien, i) => {
      const repetido = vistos.has(asignados[i]);
      vistos.add(asignados[i]);
      return [quien, asignados[i], repetido];
    });
    setReparto({ entre: entre.nombre, que: que.nombre, filas });
    prepararAudio();
    tic();
  }
  async function copiarTabla() {
    if (!reparto) return;
    const texto = `${reparto.entre}\t${reparto.que}\n` + reparto.filas.map((f) => `${f[0]}\t${f[1]}`).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setAvisoReparto("Tabla copiada. Puedes pegarla en Excel o en un documento.");
    } catch {
      setAvisoReparto("No se pudo copiar. Selecciona la tabla y cópiala a mano.");
    }
  }

  const sinElementos = pool.length === 0;
  const hayCambios = pool.length !== activa.items.length || pool.some((v, i) => v !== activa.items[i]) || historial.length > 0;

  return (
    <div className={"app hr-page" + (pestana === "ruleta" ? " hr-fullh" : "")}>
      <header className="ref-topbar">
        <Brand subtitle="Ruleta de sorteos" onClick={goHome} />
        <button className="hr-back" onClick={goHome}>← Volver al inicio</button>
      </header>

      <main className={"hr-main" + (pestana === "ruleta" ? " hr-main-full" : "")}>
        <div className="hr-bar">
          <div className="hr-tabs" role="tablist" aria-label="Secciones de la ruleta">
            <button role="tab" aria-selected={pestana === "ruleta"} className={"hr-tab" + (pestana === "ruleta" ? " on" : "")} onClick={() => setPestana("ruleta")}>🎡 Ruleta</button>
            <button role="tab" aria-selected={pestana === "repartir"} className={"hr-tab" + (pestana === "repartir" ? " on" : "")} onClick={() => setPestana("repartir")}>🎲 Repartir listas</button>
          </div>
          <span className="hr-tools">
            {pestana === "ruleta" && (
              <button className="hr-icon" aria-pressed={soloRuleta} aria-label="Ocultar listas" title={soloRuleta ? "Mostrar listas" : "Ocultar listas (ruleta más grande)"} onClick={() => setSoloRuleta(!soloRuleta)}>◧</button>
            )}
            <button className="hr-icon" aria-pressed={mascota} aria-label="Mostrar mascota" title="Mostrar u ocultar la mascota" onClick={() => setMascota(!mascota)}>🐉</button>
            <button className="hr-icon" aria-pressed={sonido} aria-label="Sonido" title={sonido ? "Sonido activado" : "Sonido apagado"} onClick={() => { prepararAudio(); setSonido(!sonido); }}>{sonido ? "🔊" : "🔇"}</button>
          </span>
        </div>

        {pestana === "ruleta" && (
          <div className={"hr-ruleta" + (soloRuleta ? " solo" : "")}>
            {!soloRuleta && (
              <aside className="hr-card hr-listas" aria-label="Listas de sorteo">
                <label className="hr-label" htmlFor="hr-lista">Lista</label>
                <select id="hr-lista" value={activa.id} disabled={ocupada} onChange={(e) => cambiarLista(e.target.value)}>
                  {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre || "Sin nombre"}</option>)}
                </select>
                <div className="hr-row">
                  <button className="hr-btn hr-sm" disabled={ocupada} onClick={nuevaLista}>➕ Nueva</button>
                  <button className="hr-btn hr-sm" disabled={ocupada} onClick={borrarLista}>🗑️ Borrar</button>
                </div>

                <label className="hr-label" htmlFor="hr-nombre">Nombre de la lista</label>
                <input id="hr-nombre" type="text" maxLength={40} autoComplete="off" value={activa.nombre} disabled={ocupada} onChange={(e) => renombrar(e.target.value)} />

                <label className="hr-label" htmlFor="hr-items">Elementos (uno por línea)</label>
                <textarea id="hr-items" spellCheck={false} value={borrador} disabled={ocupada} onChange={(e) => editarElementos(e.target.value)} placeholder="Escribe o pega un elemento por línea…" />
                <p className="hr-muted" role="status">En la ruleta: {pool.length} de {activa.items.length} guardados.</p>

                <div className="hr-row">
                  <button className="hr-btn hr-sm" disabled={ocupada || pool.length < 2} onClick={mezclarLista}>🔀 Mezclar</button>
                  <button className="hr-btn hr-sm" disabled={ocupada || !hayCambios} onClick={restaurarLista}>↩️ Restaurar lista</button>
                </div>
                <label className="hr-check">
                  <input type="checkbox" checked={quitar} disabled={ocupada} onChange={(e) => setQuitar(e.target.checked)} />
                  Quitar de la ruleta lo que salga
                </label>
              </aside>
            )}

            {/* CENTRO: nombre que salió (arriba), ruleta y botón Girar */}
            <section className="hr-centro">
              <div className={"hr-resultado" + (resultado.gano ? " gano" : "")} aria-live="polite" aria-atomic="true">
                <span className="hr-etiqueta">{resultado.etiqueta}</span>
                <strong key={resultado.clave} className={"hr-ganador" + (resultado.gano ? " pop" : "")}>{resultado.texto}</strong>
              </div>
              <div className="hr-wheel-box">
                <div className="hr-wheel">
                  <canvas ref={canvasRef} role="img" aria-label={sinElementos ? "Ruleta vacía" : `Ruleta con ${plural(pool.length, "elemento", "elementos")}`} />
                </div>
              </div>
              <button className="hr-btn hr-primary hr-grande" disabled={ocupada || sinElementos} onClick={girar}>🎯 Girar</button>
            </section>

            {/* DERECHA: mascota e historial de los que ya salieron */}
            <aside className="hr-card hr-lateral" aria-label="Historial de sorteos">
              {mascota && <img className="hr-lateral-mascota" src={resultado.gano ? CONFIG.mascota.ganador : CONFIG.mascota.espera} alt="" aria-hidden="true" />}
              <div className="hr-lateral-titulo">
                <b>Salieron</b>
                {historial.length > 0 && <span className="hr-contador">{historial.length}</span>}
              </div>
              {historial.length === 0 ? (
                <p className="hr-muted">Aún no ha salido nadie.</p>
              ) : (
                <ol className="hr-lista-salidos">
                  {historial.map((h, i) => ({ h, n: i + 1 })).reverse().map(({ h, n }) => (
                    <li key={n}><span className="n">{n}</span><span className="t">{h}</span></li>
                  ))}
                </ol>
              )}
              {historial.length > 0 && (
                <button className="hr-link" onClick={() => setHistoriales({ ...historiales, [activa.id]: [] })}>Borrar historial</button>
              )}
            </aside>
          </div>
        )}

        {pestana === "repartir" && (
          <section className="hr-card hr-repartir" aria-label="Repartir una lista entre otra">
            <h2>Repartir una lista entre otra</h2>
            <p className="hr-muted">Ejemplo: reparte la lista «Temas» entre la lista «Alumnos» y a cada alumno le tocará un tema al azar.</p>
            <div className="hr-reparto-controles">
              <div>
                <label className="hr-label" htmlFor="hr-que">Lista a repartir</label>
                <select id="hr-que" value={queId} onChange={(e) => setRepartirQue(e.target.value)}>
                  {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre || "Sin nombre"}</option>)}
                </select>
              </div>
              <div>
                <label className="hr-label" htmlFor="hr-entre">Entre los de la lista</label>
                <select id="hr-entre" value={entreId} onChange={(e) => setRepartirEntre(e.target.value)}>
                  {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre || "Sin nombre"}</option>)}
                </select>
              </div>
              <button className="hr-btn hr-primary" onClick={repartir}>Repartir al azar</button>
            </div>
            {avisoReparto && <p className="hr-aviso" role="status">{avisoReparto}</p>}
            {reparto && (
              <>
                <div className="hr-tabla">
                  <table>
                    <thead><tr><th className="n">#</th><th>{reparto.entre || "Lista"}</th><th>{reparto.que || "Le tocó"}</th></tr></thead>
                    <tbody>
                      {reparto.filas.map((f, i) => (
                        <tr key={i}>
                          <td className="n">{i + 1}</td>
                          <td>{f[0]}</td>
                          <td>{f[1]}{f[2] && <span className="hr-rep">repetido</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="hr-row"><button className="hr-btn hr-sm" onClick={copiarTabla}>📋 Copiar tabla</button></div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
