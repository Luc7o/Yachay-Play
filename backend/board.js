// ============================================================================
// MAPA DEL TABLERO DE LUDO REAL (15 x 15 casillas)
// ============================================================================
// El tablero clásico es una cuadrícula de 15x15. Sobre ella hay:
//   - Un ANILLO exterior de 52 casillas por donde giran todas las fichas.
//   - 4 RECTAS FINALES de 5 casillas (una por color) que llevan a la meta.
//   - 4 CASAS (los cuadrados de 6x6 en las esquinas) donde las fichas esperan.
//
// Cada casilla se escribe como [fila, columna] con índices de 0 a 14.
// Este mismo archivo existe igual en el frontend (frontend/src/board.js) para
// que servidor y navegador dibujen y calculen exactamente el mismo tablero.
// ============================================================================

// --- El anillo exterior, en orden, girando en sentido horario ---------------
// El índice 0 es la casilla de salida del equipo ROJO.
export const RING = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],        // 0-4   brazo izquierdo
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],// 5-10  sube por la columna 6
  [0, 7],                                        // 11    cruce superior
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],// 12-17 baja por la columna 8
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], // 18-23 brazo derecho
  [7, 14],                                       // 24    cruce derecho
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], // 25-30 vuelve por la fila 8
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], // 31-36 baja por la columna 8
  [14, 7],                                       // 37    cruce inferior
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], // 38-43 sube por la columna 6
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],// 44-49 brazo izquierdo (fila 8)
  [7, 0], [6, 0],                                // 50-51 cruce izquierdo
];

// --- Dónde entra al anillo cada equipo -------------------------------------
// Están separadas 13 casillas entre sí (52 / 4 equipos = 13).
export const START_INDEX = { rojo: 0, verde: 13, amarillo: 26, azul: 39 };

// --- Rectas finales (5 casillas de color que llevan al centro) --------------
export const HOME_COLUMNS = {
  rojo: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  verde: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  amarillo: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  azul: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

// --- Casillas seguras (las "estrellas": ahí nadie te puede comer) -----------
export const SAFE_INDEXES = [0, 8, 13, 21, 26, 34, 39, 47];

export const CENTER = [7, 7];

// ============================================================================
// EL RECORRIDO DE UNA FICHA
// ============================================================================
// Una ficha no recorre "el anillo": recorre SU PROPIO camino de 57 pasos.
//
//   paso -1        -> está en casa (todavía no salió)
//   pasos 0 a 50   -> 51 casillas del anillo, contando desde SU salida
//   pasos 51 a 55  -> las 5 casillas de su recta final
//   paso 56        -> META (el centro del tablero)
// ============================================================================
export const RING_STEPS = 51;
export const GOAL_STEP = 56;

/** Devuelve la casilla [fila, columna] donde se dibuja una ficha, o null si está en casa. */
export function cellForStep(team, step) {
  if (step === null || step === undefined || step < 0) return null;
  if (step < RING_STEPS) return RING[(START_INDEX[team] + step) % RING.length];
  if (step < GOAL_STEP) return HOME_COLUMNS[team][step - RING_STEPS];
  return CENTER;
}

/**
 * Traduce el paso personal de una ficha a un índice del anillo compartido (0-51).
 * Devuelve null si la ficha está en casa o ya entró a su recta final,
 * porque ahí no puede coincidir con nadie y no se la puede comer.
 */
export function ringIndexForStep(team, step) {
  if (step === null || step === undefined || step < 0 || step >= RING_STEPS) return null;
  return (START_INDEX[team] + step) % RING.length;
}

export const cellKey = (cell) => `${cell[0]},${cell[1]}`;
