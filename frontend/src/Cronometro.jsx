import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Brand } from "./Brand";
import { prepararAudio, nota } from "./herramientasAudio";
import { cronometro, useCronometro } from "./cronometroStore";
import "./herramientas.css";

// ============================================================================
// CRONÓMETRO DE ACTIVIDAD
// ============================================================================
// Pantalla pensada para proyectar en el aula: el docente escribe la actividad,
// elige el tiempo y todos ven la cuenta regresiva. Funciona sin cuenta y sin
// servidor (todo ocurre en el navegador).
//
// El reloj en sí vive en cronometroStore.js: sigue corriendo si el docente
// vuelve al inicio y entonces aparece la ventanita (CronometroMini.jsx).
//
// Lo más fácil de personalizar está en CONFIG (abajo). Los colores de cada
// estado (normal / amarillo / rojo / terminado) están en herramientas.css.
// ============================================================================

const CONFIG = {
  // Imagen de la mascota según el estado (rutas dentro de frontend/public/)
  mascota: {
    normal: "/condor-256.png",
    aviso: "/condor-256.png", // queda el 30 % o menos
    urgente: "/condor-256.png", // queda el 10 % o menos
    fin: "/condor-256.png", // terminó el tiempo
  },
  avisoEn: 0.3, // el fondo se pone amarillo cuando queda el 30 % o menos
  urgenteEn: 0.1, // y rojo cuando queda el 10 % o menos
  tiemposRapidos: [1, 3, 5, 10, 15, 30], // botones de minutos
  // el sonido al terminar se cambia en cronometroStore.js (PITIDO)
  textos: { iniciar: "▶ Iniciar", pausar: "⏸ Pausar", continuar: "▶ Continuar", otraVez: "▶ Iniciar de nuevo", fin: "¡Tiempo!" },
  clave: "yachayplay.cronometro.v1", // dónde se guarda lo último que usaste en este navegador
};

const pad = (n) => (n < 10 ? "0" : "") + n;
function formato(ms) {
  const s = Math.ceil(ms / 1000); // hacia arriba: se ve 05:00 al empezar y 00:00 solo al terminar
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}
// Cuánto se reduce el cronómetro según lo largo que sea el texto de la actividad.
// Texto corto (hasta ~40 letras) = tamaño completo; con 500 letras baja hasta ESCALA_MIN.
// Cada salto de línea cuenta como ~30 letras (ocupa una línea entera).
const ESCALA_MIN = 0.6;
function escalaPorTexto(texto) {
  const t = texto.trim();
  if (!t) return 1;
  const largo = t.length + (t.split("\n").length - 1) * 30;
  return Math.max(ESCALA_MIN, Math.min(1, 1 - (largo - 40) * 0.00087));
}
const aNumero = (v, min, max) => {
  const n = parseInt(v, 10);
  return Math.min(max, Math.max(min, Number.isNaN(n) ? 0 : n));
};

function leerGuardado() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.clave) || "{}") || {};
  } catch {
    return {};
  }
}

// Listas guardadas por la Ruleta (para cargar los turnos de las exposiciones)
function leerListasRuleta() {
  try {
    const d = JSON.parse(localStorage.getItem("yachayplay.ruleta.v1") || "null");
    return (d && Array.isArray(d.listas) ? d.listas : []).filter((l) => l && Array.isArray(l.items) && l.items.length);
  } catch {
    return [];
  }
}

export function Cronometro({ goHome }) {
  const guardado = useRef(leerGuardado()).current;
  const [minutos, setMinutos] = useState(String(guardado.min ?? 5));
  const [segundos, setSegundos] = useState(String(guardado.sec ?? 0));
  const [actividad, setActividad] = useState(guardado.actividad ?? "");
  const [sonido, setSonido] = useState(guardado.sonido !== false);
  const [mascota, setMascota] = useState(guardado.mascota === true); // diseño "Campus": apagada salvo que el docente la encienda
  // Modo exposiciones: turnos (grupos/estudiantes), minutos de exposición y de preguntas
  const [modo, setModo] = useState(guardado.modo === "expo" ? "expo" : "simple");
  const [turnosTxt, setTurnosTxt] = useState(guardado.turnos ?? "");
  const [minExpo, setMinExpo] = useState(String(guardado.minExpo ?? 10));
  const [minPreg, setMinPreg] = useState(String(guardado.minPreg ?? 3));
  const [turnoIdx, setTurnoIdx] = useState(guardado.turnoIdx ?? 0);
  const [fase, setFase] = useState(guardado.fase === "preg" ? "preg" : "expo"); // expo | preg

  // El reloj vive fuera de esta pantalla (cronometroStore.js)
  const { estado, total, restante } = useCronometro(); // estado: idle | running | paused | done
  // Si se vuelve desde la ventanita con el conteo en marcha, se abre en pantalla limpia
  const [limpio, setLimpio] = useState(() => cronometro.leer().estado !== "idle"); // true = pantalla limpia (sin controles)
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [aviso, setAviso] = useState(""); // texto para lectores de pantalla

  const textareaRef = useRef(null);

  // ---- Modo exposiciones: qué turno y qué fase (exposición o preguntas) toca ----
  const esExpo = modo === "expo";
  const turnos = turnosTxt.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 100);
  const idx = Math.min(turnoIdx, Math.max(0, turnos.length - 1));
  const msExpo = aNumero(minExpo, 0, 99) * 60000;
  const msPreg = aNumero(minPreg, 0, 99) * 60000;
  const msFase = (f) => (f === "preg" ? msPreg : msExpo);
  const etiquetaTurno = (i, f) => (turnos.length ? `${f === "preg" ? "Preguntas · " : ""}${turnos[i]} (${i + 1}/${turnos.length})` : "Agrega los turnos");
  const actividadMostrada = esExpo ? etiquetaTurno(idx, fase) : actividad;
  const hayMas = esExpo && (idx + 1 < turnos.length || (fase === "expo" && msPreg > 0));
  const listasRuleta = esExpo ? leerListasRuleta() : [];

  const sinMensaje = actividadMostrada.trim() === ""; // sin mensaje: en pantalla limpia el número ocupa todo y va al centro

  // Duración que marcan las casillas de minutos y segundos (o la fase del turno en modo exposiciones)
  const duracionElegida = esExpo ? msFase(fase) : (aNumero(minutos, 0, 99) * 60 + aNumero(segundos, 0, 59)) * 1000;
  const mostrado = estado === "idle" ? duracionElegida : restante;
  const duracionTotal = estado === "idle" ? duracionElegida : total;
  const proporcion = duracionTotal > 0 ? Math.max(0, Math.min(1, mostrado / duracionTotal)) : 0;

  // Estado visual: cambia el color de todo el fondo
  let visual = "normal";
  if (estado === "done") visual = "fin";
  else if (estado === "running" || estado === "paused") {
    if (proporcion <= CONFIG.urgenteEn) visual = "urgente";
    else if (proporcion <= CONFIG.avisoEn) visual = "aviso";
  }

  // ---------------- Pantalla completa ----------------
  const puedePantallaCompleta = typeof document !== "undefined" && !!document.fullscreenEnabled;
  function entrarPantallaCompleta() {
    try {
      if (puedePantallaCompleta && !document.fullscreenElement) {
        const r = document.documentElement.requestFullscreen();
        if (r && r.catch) r.catch(() => {});
      }
    } catch {
      /* algunos navegadores (p. ej. iPhone) no lo permiten */
    }
  }
  function salirPantallaCompleta() {
    try {
      if (document.fullscreenElement) {
        const r = document.exitFullscreen();
        if (r && r.catch) r.catch(() => {});
      }
    } catch {
      /* nada */
    }
  }
  function alternarPantallaCompleta() {
    if (document.fullscreenElement) salirPantallaCompleta();
    else entrarPantallaCompleta();
  }

  // ---------------- Control del tiempo ----------------
  // El conteo corre en cronometroStore.js (con la hora del sistema), así sigue
  // aunque se salga de esta pantalla.
  function iniciar() {
    if (duracionElegida <= 0 || (esExpo && !turnos.length)) return;
    prepararAudio();
    cronometro.iniciar(duracionElegida, { actividad: actividadMostrada });
    // Modo proyección automático: sin controles y en pantalla completa
    setLimpio(true);
    entrarPantallaCompleta();
  }
  // Modo exposiciones: arranca de una vez el turno i en la fase f
  function arrancarTurno(i, f) {
    setTurnoIdx(i);
    setFase(f);
    const ms = msFase(f);
    if (ms <= 0) return;
    prepararAudio();
    cronometro.iniciar(ms, { actividad: etiquetaTurno(i, f) });
    setLimpio(true);
    entrarPantallaCompleta();
  }
  function reiniciarTurnos() {
    cronometro.reiniciar();
    setTurnoIdx(0);
    setFase("expo");
    setLimpio(false);
    salirPantallaCompleta();
  }
  // Siguiente: de la exposición pasa a las preguntas y luego al turno siguiente; tras el último, termina
  function siguiente() {
    if (!esExpo || !turnos.length) return;
    if (fase === "expo" && msPreg > 0) return arrancarTurno(idx, "preg");
    if (idx + 1 < turnos.length) return arrancarTurno(idx + 1, "expo");
    reiniciarTurnos();
  }
  function cargarDeRuleta(id) {
    const l = listasRuleta.find((x) => x.id === id);
    if (!l) return;
    setTurnosTxt(l.items.join("\n"));
    setTurnoIdx(0);
    setFase("expo");
  }
  function pausar() {
    cronometro.pausar();
  }
  function continuar() {
    prepararAudio();
    cronometro.continuar();
  }
  function reiniciar() {
    cronometro.reiniciar();
    setLimpio(false); // vuelve a mostrar los controles para configurar
    salirPantallaCompleta();
  }
  function alternar() {
    if (estado === "idle" || estado === "done") iniciar();
    else if (estado === "running") pausar();
    else continuar();
  }
  // "Volver al inicio": si el conteo sigue, aparece en una ventanita
  function irAlInicio() {
    salirPantallaCompleta();
    goHome();
  }

  // Avisa al reloj si esta pantalla está a la vista (la ventanita solo sale cuando NO lo está)
  useEffect(() => {
    cronometro.ajustar({ abierto: true });
    return () => cronometro.ajustar({ abierto: false });
  }, []);
  // La ventanita muestra la actividad escrita
  useEffect(() => {
    cronometro.ajustar({ actividad: actividadMostrada });
  }, [actividadMostrada]);

  // Que la pantalla no se apague mientras corre (si el navegador lo permite)
  useEffect(() => {
    if (estado !== "running" || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelado = false;
    navigator.wakeLock
      .request("screen")
      .then((l) => (cancelado ? l.release() : (lock = l)))
      .catch(() => {});
    return () => {
      cancelado = true;
      if (lock) lock.release().catch(() => {});
    };
  }, [estado]);

  // Aviso para lectores de pantalla solo cuando cambia el estado (no cada segundo)
  const visualAnterior = useRef("normal");
  useEffect(() => {
    if (visual === visualAnterior.current) return;
    visualAnterior.current = visual;
    if (visual === "aviso") setAviso(`Queda el ${Math.round(CONFIG.avisoEn * 100)} por ciento del tiempo.`);
    if (visual === "urgente") setAviso(`Queda el ${Math.round(CONFIG.urgenteEn * 100)} por ciento del tiempo.`);
    if (visual === "fin") setAviso(CONFIG.textos.fin);
  }, [visual]);

  // Mantiene el estado del botón de pantalla completa al día
  useEffect(() => {
    const cambio = () => setPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", cambio);
    return () => document.removeEventListener("fullscreenchange", cambio);
  }, []);

  // ---------------- Atajos de teclado ----------------
  const accionesRef = useRef({});
  accionesRef.current = { alternar, alternarPantallaCompleta, limpio, setLimpio, mascota, setMascota, siguiente };
  useEffect(() => {
    const alPulsar = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const etiqueta = t && t.tagName;
      if (etiqueta === "INPUT" || etiqueta === "TEXTAREA" || etiqueta === "SELECT") return; // está escribiendo
      const a = accionesRef.current;
      if (e.code === "Space") {
        if (etiqueta === "BUTTON") return; // sobre un botón, el espacio ya lo "pulsa"
        e.preventDefault();
        a.alternar();
      } else if (e.key === "f" || e.key === "F") a.alternarPantallaCompleta();
      else if (e.key === "c" || e.key === "C") a.setLimpio(!a.limpio);
      else if (e.key === "m" || e.key === "M") a.setMascota(!a.mascota);
      else if (e.key === "n" || e.key === "N") a.siguiente();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, []);

  // ---------------- Guardado en este navegador ----------------
  useEffect(() => {
    try {
      localStorage.setItem(
        CONFIG.clave,
        JSON.stringify({
          actividad, min: aNumero(minutos, 0, 99), sec: aNumero(segundos, 0, 59), sonido, mascota,
          modo, turnos: turnosTxt, minExpo: aNumero(minExpo, 0, 99), minPreg: aNumero(minPreg, 0, 99), turnoIdx: idx, fase,
        })
      );
    } catch {
      /* si el navegador no deja guardar, no pasa nada */
    }
  }, [actividad, minutos, segundos, sonido, mascota, modo, turnosTxt, minExpo, minPreg, idx, fase]);

  // La caja de la actividad crece según lo que se escriba. Si el texto es tan largo que
  // no cabe en el alto máximo, la letra se achica sola (hasta un mínimo legible) en vez de
  // mostrar la barra de desplazamiento.
  useLayoutEffect(() => {
    const ajustar = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.fontSize = ""; // vuelve al tamaño que define el CSS
      el.style.height = "auto";
      const cs = getComputedStyle(el);
      const borde = el.offsetHeight - el.clientHeight; // alto de los bordes: sin esto aparece un scroll de 1-2 px
      const tope = parseFloat(cs.maxHeight); // alto máximo permitido, en px
      const minimo = limpio ? 20 : 15; // no bajar de aquí para que se siga leyendo
      let tam = parseFloat(cs.fontSize);
      if (Number.isFinite(tope)) {
        while (el.scrollHeight + borde > tope + 1 && tam > minimo) {
          tam -= 1;
          el.style.fontSize = tam + "px";
          el.style.height = "auto";
        }
      }
      el.style.height = el.scrollHeight + borde + "px";
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [actividadMostrada, limpio]);

  // ---------------- Casillas de tiempo ----------------
  const bloqueado = estado === "running" || estado === "paused";
  function cambiarTiempo(setter, valor) {
    setter(valor);
    if (estado === "done") cronometro.reiniciar();
  }
  function elegirRapido(m) {
    setMinutos(String(m));
    setSegundos("0");
    cronometro.reiniciar();
  }

  const etiquetaInicio =
    estado === "running" ? CONFIG.textos.pausar : estado === "paused" ? CONFIG.textos.continuar : estado === "done" ? CONFIG.textos.otraVez : CONFIG.textos.iniciar;

  return (
    <div className={"app hr-page hr-timer" + (limpio ? " is-limpio" : "") + (limpio && sinMensaje ? " sin-mensaje" : "")} data-estado={visual} style={{ "--hr-escala": escalaPorTexto(actividadMostrada) }}>
      {!limpio && (
        <header className="ref-topbar">
          <Brand subtitle="Cronómetro de actividad" onClick={irAlInicio} />
          <button className="hr-back" onClick={irAlInicio} title={estado === "running" || estado === "paused" ? "El cronómetro seguirá en una ventanita" : undefined}>← Volver al inicio</button>
        </header>
      )}

      <main className="hr-stage">
        {/* Actividad: cuadro visible y cómodo para escribir */}
        {!(limpio && sinMensaje) && (
        <div className="hr-activity-wrap">
          {!limpio && <span className="hr-activity-label" aria-hidden="true">{esExpo ? "🎤 Turno actual" : "✏️ Actividad para los alumnos"}</span>}
          <textarea
            ref={textareaRef}
            className="hr-activity"
            rows={2}
            value={actividadMostrada}
            readOnly={esExpo}
            onChange={(e) => !esExpo && setActividad(e.target.value)}
            placeholder={limpio ? "" : "Escribe aquí la actividad o el mensaje…"}
            aria-label="Actividad que deben realizar los alumnos"
            maxLength={500}
          />
        </div>
        )}

        <div className="hr-time" role="timer" aria-live="off">{formato(mostrado)}</div>
        <p className="hr-msg" aria-hidden="true">{estado === "done" ? CONFIG.textos.fin : ""}</p>
        {esExpo && turnos.length > 0 && (
          <p className="hr-sig" aria-hidden="true">
            {hayMas ? `Sigue: ${fase === "expo" && msPreg > 0 ? "preguntas" : turnos[idx + 1]}` : "Último turno"}
          </p>
        )}

        <div
          className="hr-progress"
          role="progressbar"
          aria-label="Tiempo restante"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(proporcion * 100)}
        >
          <i style={{ width: `${proporcion * 100}%` }} />
        </div>

        {mascota && <img className="hr-mascot" src={CONFIG.mascota[visual === "normal" ? "normal" : visual]} alt="" aria-hidden="true" />}
      </main>

      {!limpio && (
        <section className="hr-controls" aria-label="Controles del cronómetro">
          <div className="hr-chips hr-modos" role="group" aria-label="Modo del cronómetro">
            <button className={"hr-chip" + (!esExpo ? " on" : "")} aria-pressed={!esExpo} disabled={bloqueado} onClick={() => setModo("simple")}>⏱ Simple</button>
            <button className={"hr-chip" + (esExpo ? " on" : "")} aria-pressed={esExpo} disabled={bloqueado} onClick={() => setModo("expo")}>🎤 Exposiciones</button>
          </div>

          {esExpo ? (
          <div className="hr-set hr-expo">
            <label className="hr-field hr-turnos">
              <span>Turnos (uno por línea: grupo o estudiante)</span>
              <textarea rows={4} value={turnosTxt} disabled={bloqueado} placeholder={"Grupo 1\nGrupo 2\nGrupo 3"}
                onChange={(e) => { setTurnosTxt(e.target.value); setTurnoIdx(0); setFase("expo"); }} />
            </label>
            <label className="hr-field">
              <span>Exposición (min)</span>
              <input type="number" inputMode="numeric" min={0} max={99} value={minExpo} disabled={bloqueado}
                onChange={(e) => cambiarTiempo(setMinExpo, e.target.value)} onBlur={() => setMinExpo(String(aNumero(minExpo, 0, 99)))} />
            </label>
            <label className="hr-field">
              <span>Preguntas (min, 0 = sin)</span>
              <input type="number" inputMode="numeric" min={0} max={99} value={minPreg} disabled={bloqueado}
                onChange={(e) => cambiarTiempo(setMinPreg, e.target.value)} onBlur={() => setMinPreg(String(aNumero(minPreg, 0, 99)))} />
            </label>
            {listasRuleta.length > 0 && (
              <label className="hr-field">
                <span>Cargar turnos desde la Ruleta</span>
                <select value="" disabled={bloqueado} onChange={(e) => cargarDeRuleta(e.target.value)}>
                  <option value="">Elegir lista…</option>
                  {listasRuleta.map((l) => <option key={l.id} value={l.id}>{l.nombre} ({l.items.length})</option>)}
                </select>
              </label>
            )}
          </div>
          ) : (
          <div className="hr-set">
            <label className="hr-field">
              <span>Minutos</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={minutos}
                disabled={bloqueado}
                onChange={(e) => cambiarTiempo(setMinutos, e.target.value)}
                onBlur={() => setMinutos(String(aNumero(minutos, 0, 99)))}
              />
            </label>
            <label className="hr-field">
              <span>Segundos</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={segundos}
                disabled={bloqueado}
                onChange={(e) => cambiarTiempo(setSegundos, e.target.value)}
                onBlur={() => setSegundos(String(aNumero(segundos, 0, 59)))}
              />
            </label>
            <div className="hr-chips" role="group" aria-label="Tiempos rápidos">
              {CONFIG.tiemposRapidos.map((m) => (
                <button key={m} className="hr-chip" disabled={bloqueado} onClick={() => elegirRapido(m)} title={bloqueado ? "Pulsa Reiniciar para cambiar el tiempo" : ""}>
                  {m} min
                </button>
              ))}
            </div>
          </div>
          )}

          <div className="hr-actions">
            <button className="hr-btn hr-primary" onClick={alternar} disabled={(estado === "idle" || estado === "done") && (duracionElegida <= 0 || (esExpo && !turnos.length))} title="Barra espaciadora">
              {etiquetaInicio}
            </button>
            {esExpo && <button className="hr-btn" onClick={siguiente} disabled={!turnos.length || estado === "idle"} title="Tecla N">{hayMas ? "⏭ Siguiente" : "🏁 Terminar"}</button>}
            <button className="hr-btn" onClick={reiniciar}>↺ Reiniciar</button>
            {esExpo && <button className="hr-btn" onClick={reiniciarTurnos} disabled={bloqueado}>⟲ Turnos desde el inicio</button>}
            <span className="hr-tools">
              <button className="hr-icon" aria-pressed={sonido} aria-label="Sonido" title={sonido ? "Sonido activado" : "Sonido apagado"}
                onClick={() => { prepararAudio(); setSonido(!sonido); if (!sonido) nota(880, 0, 0.12, 0.3); }}>
                {sonido ? "🔊" : "🔇"}
              </button>
              <button className="hr-icon" aria-pressed={mascota} aria-label="Mostrar mascota" title="Mostrar u ocultar la mascota (M)" onClick={() => setMascota(!mascota)}><img className="hr-icon-condor" src="/condor-256.png" alt="" width="22" height="22" /></button>
              {puedePantallaCompleta && (
                <button className="hr-icon" aria-pressed={pantallaCompleta} aria-label="Pantalla completa" title="Pantalla completa (F)" onClick={alternarPantallaCompleta}>⛶</button>
              )}
              <button className="hr-icon" aria-label="Ocultar controles" title="Ocultar controles (C)" onClick={() => setLimpio(true)}>🙈</button>
            </span>
          </div>
        </section>
      )}

      {limpio && (
        <div className="hr-mini" role="group" aria-label="Controles rápidos">
          {estado !== "idle" && (
            <button aria-label={estado === "running" ? "Pausar" : "Continuar"} title={estado === "running" ? "Pausar (barra espaciadora)" : "Continuar (barra espaciadora)"} onClick={alternar}>
              {estado === "running" ? "⏸" : "▶"}
            </button>
          )}
          {esExpo && estado !== "idle" && (
            <button aria-label={hayMas ? "Siguiente" : "Terminar"} title={hayMas ? "Siguiente (N)" : "Terminar (N)"} onClick={siguiente}>{hayMas ? "⏭" : "🏁"}</button>
          )}
          {estado !== "idle" && (
            <button aria-label="Reiniciar" title="Detener y volver a configurar" onClick={reiniciar}>↺</button>
          )}
          <button aria-label="Volver al inicio" title={estado === "idle" ? "Volver al inicio" : "Volver al inicio (el cronómetro sigue en una ventanita)"} onClick={irAlInicio}>🏠</button>
          <button aria-label="Mostrar controles" title="Mostrar controles (C)" onClick={() => setLimpio(false)}>⚙️</button>
        </div>
      )}
      <div className="sr-only" aria-live="polite">{aviso}</div>
    </div>
  );
}
