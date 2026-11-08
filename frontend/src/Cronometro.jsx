import React, { useEffect, useRef, useState } from "react";
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
    normal: "/mascota-explica.png",
    aviso: "/mascota-explica.png", // queda el 30 % o menos
    urgente: "/mascota-explica.png", // queda el 10 % o menos
    fin: "/mascota-gana.png", // terminó el tiempo
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

export function Cronometro({ goHome }) {
  const guardado = useRef(leerGuardado()).current;
  const [minutos, setMinutos] = useState(String(guardado.min ?? 5));
  const [segundos, setSegundos] = useState(String(guardado.sec ?? 0));
  const [actividad, setActividad] = useState(guardado.actividad ?? "");
  const [sonido, setSonido] = useState(guardado.sonido !== false);
  const [mascota, setMascota] = useState(guardado.mascota !== false);

  // El reloj vive fuera de esta pantalla (cronometroStore.js)
  const { estado, total, restante } = useCronometro(); // estado: idle | running | paused | done
  // Si se vuelve desde la ventanita con el conteo en marcha, se abre en pantalla limpia
  const [limpio, setLimpio] = useState(() => cronometro.leer().estado !== "idle"); // true = pantalla limpia (sin controles)
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [aviso, setAviso] = useState(""); // texto para lectores de pantalla

  const textareaRef = useRef(null);
  const sinMensaje = actividad.trim() === ""; // sin mensaje: en pantalla limpia el número ocupa todo y va al centro

  // Duración que marcan las casillas de minutos y segundos
  const duracionElegida = (aNumero(minutos, 0, 99) * 60 + aNumero(segundos, 0, 59)) * 1000;
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
    if (duracionElegida <= 0) return;
    prepararAudio();
    cronometro.iniciar(duracionElegida, { actividad });
    // Modo proyección automático: sin controles y en pantalla completa
    setLimpio(true);
    entrarPantallaCompleta();
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
    cronometro.ajustar({ actividad });
  }, [actividad]);

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
  accionesRef.current = { alternar, alternarPantallaCompleta, limpio, setLimpio, mascota, setMascota };
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
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, []);

  // ---------------- Guardado en este navegador ----------------
  useEffect(() => {
    try {
      localStorage.setItem(
        CONFIG.clave,
        JSON.stringify({ actividad, min: aNumero(minutos, 0, 99), sec: aNumero(segundos, 0, 59), sonido, mascota })
      );
    } catch {
      /* si el navegador no deja guardar, no pasa nada */
    }
  }, [actividad, minutos, segundos, sonido, mascota]);

  // La caja de la actividad crece según lo que se escriba
  useEffect(() => {
    const ajustar = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      const borde = el.offsetHeight - el.clientHeight; // alto de los bordes: sin esto aparece un scroll de 1-2 px
      el.style.height = el.scrollHeight + borde + "px";
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [actividad, limpio]);

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
    <div className={"app hr-page hr-timer" + (limpio ? " is-limpio" : "") + (limpio && sinMensaje ? " sin-mensaje" : "")} data-estado={visual}>
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
          {!limpio && <span className="hr-activity-label" aria-hidden="true">✏️ Actividad para los alumnos</span>}
          <textarea
            ref={textareaRef}
            className="hr-activity"
            rows={2}
            value={actividad}
            onChange={(e) => setActividad(e.target.value)}
            placeholder={limpio ? "" : "Escribe aquí la actividad o el mensaje…"}
            aria-label="Actividad que deben realizar los alumnos"
            maxLength={500}
          />
        </div>
        )}

        <div className="hr-time" role="timer" aria-live="off">{formato(mostrado)}</div>
        <p className="hr-msg" aria-hidden="true">{estado === "done" ? CONFIG.textos.fin : ""}</p>

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

          <div className="hr-actions">
            <button className="hr-btn hr-primary" onClick={alternar} disabled={estado === "idle" && duracionElegida <= 0} title="Barra espaciadora">
              {etiquetaInicio}
            </button>
            <button className="hr-btn" onClick={reiniciar}>↺ Reiniciar</button>
            <span className="hr-tools">
              <button className="hr-icon" aria-pressed={sonido} aria-label="Sonido" title={sonido ? "Sonido activado" : "Sonido apagado"}
                onClick={() => { prepararAudio(); setSonido(!sonido); if (!sonido) nota(880, 0, 0.12, 0.3); }}>
                {sonido ? "🔊" : "🔇"}
              </button>
              <button className="hr-icon" aria-pressed={mascota} aria-label="Mostrar mascota" title="Mostrar u ocultar la mascota (M)" onClick={() => setMascota(!mascota)}>🐉</button>
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
