import { socket } from "../socket";

export const LS_STUDENT = "yachay_cw_student"; // { code, playerId } — para reconectar si recarga la página

export const LS_TEACHER = "yachay_cw_teacher_code"; // código de la última sala creada por este docente

export function loadJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function saveJSON(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado del navegador: no pasa nada, solo no recuerda entre recargas */
  }
}

// El servidor SIEMPRE responde a estos mensajes (ack), pero si el backend no
// tiene esta parte del código (versión vieja o sin reiniciar), o si algo se
// corta a medio camino, esa respuesta nunca llega y la app se queda
// esperando en silencio para siempre. Con esto, si no hay respuesta en unos
// segundos, se avisa con un error en vez de quedarse "Creando…" sin fin.
export function emitConTiempoLimite(event, payload, callback, timeoutMs = 8000) {
  let resuelto = false;
  const avisoTardio = setTimeout(() => {
    if (resuelto) return;
    resuelto = true;
    callback?.({
      error:
        "El servidor no respondió a tiempo. Revisa que el backend esté encendido y actualizado (reinícialo si acabas de aplicar cambios) e inténtalo de nuevo.",
    });
  }, timeoutMs);
  socket.emit(event, payload, (ack) => {
    if (resuelto) return; // ya se disparó el aviso por tardanza; esta respuesta llegó demasiado tarde
    resuelto = true;
    clearTimeout(avisoTardio);
    callback?.(ack);
  });
}

export function mmss(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ============================================================================
// DOCENTE: vista en vivo mientras se juega
// ============================================================================
// En vez de solo un marcador, el docente ve el propio tablero (sin letras,
// nadie ve las respuestas), pintado como "mapa de calor": mientras más
// estudiantes ya resolvieron una palabra, más oscura se ve esa zona. Junto a
// eso, la lista de pistas con cuántos ya la acertaron (para detectar cuál
// está costando más) y estadísticas rápidas del grupo.
// ============================================================================
// Color del "mapa de calor" de una celda según qué % de estudiantes ya
// resolvieron la palabra que la cruza: naranja mientras va avanzando,
// verde cuando TODOS ya la tienen.
// Color de cada celda del tablero del docente, según cuántos ya la resolvieron:
//   nadie          -> blanco (el CSS por defecto de .cw-cell)
//   algunos no todos -> gris (en progreso, sin revelar nada)
//   TODOS          -> verde (ahí sí se revela la letra, ver revealedWord)
export function heatColor(pct) {
  if (!pct) return undefined;
  if (pct >= 1) return "rgba(16,185,129,0.82)"; // verde: ya la resolvieron todos
  return "rgba(100,116,139,0.55)"; // gris: en progreso (todavía no se revela nada)
}
