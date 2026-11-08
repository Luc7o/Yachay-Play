// ============================================================================
// GENERADOR DE CRUCIGRAMA
// ============================================================================
// Arma un crucigrama de verdad: cada palabra nueva se busca acomodar cruzando
// una letra con alguna palabra ya puesta (como en un crucigrama de periódico),
// nunca pegada por el lado a otra sin cruzarse. Si una palabra no logra cruzar
// con ninguna, se coloca sola más abajo para no perderla del juego.
//
// Es la MISMA rejilla para todos los jugadores de una partida (eso lo pediste:
// "tableros individuales iguales"); lo que cada quien llena por su cuenta es
// aparte, y vive en crossword/engine.js.
// ============================================================================
import { normalizeAnswer } from "./words.js";

const H = "H"; // a través (horizontal)
const V = "V"; // abajo (vertical)
const perp = (dir) => (dir === H ? V : H);

function key(r, c) {
  return `${r},${c}`;
}

// ¿Puedo poner la palabra `word` empezando en (row,col) en dirección `dir`,
// sin chocar con lo que ya hay en la rejilla?
function fits(cellLetters, cellOccupied, word, row, col, dir) {
  let cruces = 0;
  for (let i = 0; i < word.length; i++) {
    const r = dir === H ? row : row + i;
    const c = dir === H ? col + i : col;
    const existente = cellLetters.get(key(r, c));
    if (existente) {
      if (existente !== word[i]) return null; // chocarían dos letras distintas
      cruces++;
    } else {
      // Casilla libre: sus vecinos "de lado" deben estar vacíos, si no, la
      // palabra quedaría pegada a otra sin cruzarse de verdad.
      const vecino1 = dir === H ? key(r - 1, c) : key(r, c - 1);
      const vecino2 = dir === H ? key(r + 1, c) : key(r, c + 1);
      if (cellOccupied.has(vecino1) || cellOccupied.has(vecino2)) return null;
    }
  }
  // Las casillas justo antes y después de la palabra también deben estar vacías
  // (si no, se uniría visualmente con otra palabra y parecería una sola).
  const antes = dir === H ? key(row, col - 1) : key(row - 1, col);
  const despues = dir === H ? key(row, col + word.length) : key(row + word.length, col);
  if (cellOccupied.has(antes) || cellOccupied.has(despues)) return null;
  return cruces;
}

export function generateCrossword(bank) {
  const palabras = bank
    .map((w) => ({ ...w, answer: normalizeAnswer(w.word) }))
    .filter((w) => w.answer.length >= 3)
    .sort((a, b) => b.answer.length - a.answer.length); // las largas primero: dan más cruces

  const cellLetters = new Map(); // "r,c" -> letra
  const cellOccupied = new Set(); // "r,c" -> ocupada (para revisar vecinos)
  const placements = []; // [{ id, word, clue, row, col, dir, length }]
  let filaLibre = 0; // dónde poner, sin cruces, la siguiente palabra que no encaje

  palabras.forEach((p, idx) => {
    const w = p.answer;
    let mejor = null; // { row, col, dir, cruces }

    if (placements.length === 0) {
      mejor = { row: 0, col: 0, dir: H, cruces: 0 };
    } else {
      // Busca, entre TODAS las palabras ya puestas, cada letra en común con `w`
      // y evalúa si ahí encajaría (perpendicular a la palabra existente).
      for (const placed of placements) {
        for (let j = 0; j < placed.word.length; j++) {
          const letra = placed.word[j];
          const rBase = placed.dir === H ? placed.row : placed.row + j;
          const cBase = placed.dir === H ? placed.col + j : placed.col;
          const dir = perp(placed.dir);
          for (let i = 0; i < w.length; i++) {
            if (w[i] !== letra) continue;
            const row = dir === H ? rBase : rBase - i;
            const col = dir === H ? cBase - i : cBase;
            const cruces = fits(cellLetters, cellOccupied, w, row, col, dir);
            if (cruces !== null && cruces > 0 && (!mejor || cruces > mejor.cruces)) {
              mejor = { row, col, dir, cruces };
            }
          }
        }
      }
    }

    if (!mejor) {
      // No cruzó con nada: la ponemos sola, más abajo, para no perderla.
      filaLibre += 2;
      mejor = { row: filaLibre, col: 0, dir: H, cruces: 0 };
    }

    for (let i = 0; i < w.length; i++) {
      const r = mejor.dir === H ? mejor.row : mejor.row + i;
      const c = mejor.dir === H ? mejor.col + i : mejor.col;
      cellLetters.set(key(r, c), w[i]);
      cellOccupied.add(key(r, c));
    }
    placements.push({
      id: idx + 1,
      word: w,
      clue: p.clue,
      row: mejor.row,
      col: mejor.col,
      dir: mejor.dir,
      length: w.length,
    });
    filaLibre = Math.max(filaLibre, mejor.row + (mejor.dir === V ? w.length : 0));
  });

  // Recorta la rejilla al espacio realmente usado (+ 0 de margen; el margen visual lo pone el frontend)
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (const k of cellOccupied) {
    const [r, c] = k.split(",").map(Number);
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    minC = Math.min(minC, c); maxC = Math.max(maxC, c);
  }
  for (const p of placements) {
    p.row -= minR;
    p.col -= minC;
  }
  const height = maxR - minR + 1;
  const width = maxC - minC + 1;

  // Numeración estándar de crucigrama: cada casilla donde EMPIEZA una palabra
  // (horizontal o vertical) recibe un número, en orden de lectura (fila, columna).
  const inicios = new Map(); // "r,c" -> number
  const ordenadas = [...placements].sort((a, b) => a.row - b.row || a.col - b.col);
  let n = 0;
  for (const p of ordenadas) {
    const k = key(p.row, p.col);
    if (!inicios.has(k)) inicios.set(k, ++n);
    p.number = inicios.get(k);
  }

  return {
    width,
    height,
    placements: placements.map(({ row, col, dir, length, number, word, clue, id }) => ({
      id,
      number,
      row,
      col,
      dir,
      length,
      clue,
      word, // ⚠️ SOLO para el backend; nunca se manda tal cual al navegador del estudiante
    })),
  };
}
