// ============================================================================
// CÓDIGOS DE SALA (6 dígitos)
// ============================================================================
// Todos los juegos en vivo se comparten con un código de 6 dígitos que la clase
// escribe en su celular. Se generan con `crypto.randomInt` para que no se puedan
// predecir (Math.random sí se puede adivinar) y nunca empiezan con 0, así que
// siempre tienen exactamente 6 cifras.
// ============================================================================
import crypto from "node:crypto";

export const MIN_CODIGO = 100000;
export const MAX_CODIGO = 1000000; // exclusivo

// Un código cualquiera (puede estar repetido).
export const generarCodigo = () => String(crypto.randomInt(MIN_CODIGO, MAX_CODIGO));

// Código que no esté en uso en memoria. `enUso` puede ser un Map/Set (se usa
// `.has`) o una función (code) => boolean.
export function codigoLibre(enUso, generar = generarCodigo) {
  const ocupado = typeof enUso === "function" ? enUso : (c) => !!enUso?.has(c);
  let code;
  do code = generar();
  while (ocupado(code));
  return code;
}

// Para juegos que guardan la sala en la base de datos al crearla: elige un código
// libre en memoria y llama `guardar(code)`. Si la BD responde 23505 (código
// repetido por el índice único: choca con una partida vieja) prueba con otro, hasta
// `intentos` reintentos. Cualquier otro error se propaga tal cual.
export async function reservarCodigo(enUso, guardar, { intentos = 8, generar = generarCodigo } = {}) {
  for (let intento = 0; ; intento++) {
    const code = codigoLibre(enUso, generar);
    try {
      await guardar(code);
      return code;
    } catch (e) {
      if (e?.code !== "23505" || intento >= intentos) throw e;
    }
  }
}
