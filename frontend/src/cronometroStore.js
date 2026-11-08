import { useSyncExternalStore } from "react";
import { nota } from "./herramientasAudio";

// ============================================================================
// RELOJ DEL CRONÓMETRO (vive FUERA de la pantalla)
// ============================================================================
// El conteo no depende de que la pantalla del cronómetro esté abierta: si el
// docente vuelve al inicio, el reloj sigue corriendo y suena al terminar. La
// ventanita flotante (CronometroMini.jsx) lee este mismo reloj.
//
// El tiempo se calcula SIEMPRE con la hora del sistema (Date.now), no sumando
// "ticks", para que no se atrase aunque la pestaña esté en segundo plano.
// ============================================================================

const CLAVE = "yachayplay.cronometro.v1"; // la misma que usa Cronometro.jsx
export const PITIDO = { hz: 880, veces: 3, duracion: 0.28, pausa: 0.16 }; // sonido al terminar

// estado: idle | running | paused | done
let s = {
  estado: "idle",
  total: 0, // duración de la cuenta en curso (ms)
  restante: 0, // lo que falta (ms)
  actividad: "", // mensaje que se muestra en la ventanita
  abierto: false, // true = la pantalla del cronómetro está a la vista
  oculto: false, // true = no mostrar la ventanita (p. ej. durante una partida de Ludo)
};
let fin = 0; // hora exacta en que termina
let reloj = 0;
const oyentes = new Set();

function emitir(cambio) {
  s = { ...s, ...cambio };
  oyentes.forEach((f) => f());
}

function sonidoActivo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "{}").sonido !== false;
  } catch {
    return true;
  }
}
function pitidos() {
  if (!sonidoActivo()) return;
  for (let i = 0; i < PITIDO.veces; i++) nota(PITIDO.hz, 0.05 + i * (PITIDO.duracion + PITIDO.pausa), PITIDO.duracion, 0.5);
}

function revisar() {
  if (s.estado !== "running") return;
  const falta = Math.max(0, fin - Date.now());
  if (falta <= 0) {
    clearInterval(reloj);
    reloj = 0;
    emitir({ estado: "done", restante: 0 });
    pitidos();
  } else {
    emitir({ restante: falta });
  }
}
function arrancar() {
  clearInterval(reloj);
  reloj = setInterval(revisar, 100);
}
function parar() {
  clearInterval(reloj);
  reloj = 0;
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", revisar); // al volver a la pestaña, se actualiza al instante

export const cronometro = {
  leer: () => s,
  iniciar(ms, extra = {}) {
    if (ms <= 0) return;
    fin = Date.now() + ms;
    emitir({ estado: "running", total: ms, restante: ms, ...extra });
    arrancar();
  },
  pausar() {
    if (s.estado !== "running") return;
    parar();
    emitir({ estado: "paused", restante: Math.max(0, fin - Date.now()) });
  },
  continuar() {
    if (s.estado !== "paused") return;
    fin = Date.now() + s.restante;
    emitir({ estado: "running" });
    arrancar();
  },
  reiniciar() {
    parar();
    emitir({ estado: "idle", total: 0, restante: 0 });
  },
  // guarda datos sueltos (actividad, abierto, oculto) solo si cambiaron
  ajustar(cambio) {
    if (Object.keys(cambio).every((k) => s[k] === cambio[k])) return;
    emitir(cambio);
  },
};

const suscribir = (f) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};
export function useCronometro() {
  return useSyncExternalStore(suscribir, () => s, () => s);
}

const pad = (n) => (n < 10 ? "0" : "") + n;
export function formatoTiempo(ms) {
  const t = Math.ceil(ms / 1000); // hacia arriba: se ve 05:00 al empezar y 00:00 solo al terminar
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}
