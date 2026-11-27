// ============================================================================
// JUGADORES: nombres, duplicados, cupo y reanudar
// ============================================================================
// Lo que todos los juegos en vivo revisan al dejar entrar a alguien.
// ============================================================================
import crypto from "node:crypto";

// Texto limpio: los espacios repetidos se vuelven uno, sin espacios alrededor,
// cortado a `max` caracteres.
export const limpiarTexto = (s, max) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const MAX_NOMBRE = 30;
export const limpiarNombre = (s, max = MAX_NOMBRE) => limpiarTexto(s, max);

export const MENSAJES = {
  sinNombre: "Escribe tu nombre para entrar.",
  llena: "La sala está llena.",
  repetido: "Ya hay alguien con ese nombre. Agrega tu apellido o inicial.",
};

const valores = (jugadores) => (jugadores instanceof Map ? [...jugadores.values()] : [...jugadores]);

// ¿Ya hay alguien con ese nombre? (sin distinguir mayúsculas). `jugadores` es un
// Map o cualquier iterable de objetos con `name`.
export function nombreRepetido(jugadores, nombre) {
  const lower = String(nombre).toLowerCase();
  return valores(jugadores).some((p) => p.name.toLowerCase() === lower);
}

// Revisa si alguien nuevo puede entrar con ese nombre. Devuelve { nombre } (ya
// limpio) o { error }. Orden: falta el nombre -> sala llena -> nombre repetido.
//   max: cupo de la sala; maxLargo: largo máximo del nombre; unico: rechazar repetidos.
export function admitirNombre(jugadores, nombre, { max = Infinity, maxLargo = MAX_NOMBRE, unico = true } = {}) {
  const limpio = limpiarNombre(nombre, maxLargo);
  if (!limpio) return { error: MENSAJES.sinNombre };
  if (valores(jugadores).length >= max) return { error: MENSAJES.llena };
  if (unico && nombreRepetido(jugadores, limpio)) return { error: MENSAJES.repetido };
  return { nombre: limpio };
}

// Llave privada para reconectar (cuando el id del jugador es público, no basta).
export const nuevoSecreto = () => crypto.randomBytes(24).toString("base64url");

// Compara dos secretos en tiempo constante.
export function mismoSecreto(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ¿Puede quien llama retomar al jugador `existente`? Sí si es la misma cuenta que
// lo creó, o si trae su llave privada (`secreto`).
/**
 * @param {any} existente
 * @param {{ secreto?: string, userId?: string | null }} [llave]
 */
export function puedeReanudar(existente, { secreto, userId } = {}) {
  if (!existente) return false;
  if (existente.userId && userId && existente.userId === userId) return true;
  return mismoSecreto(secreto, existente.secret);
}

// Busca al jugador `id` para volver a entrar (p. ej. tras recargar la página).
//   - Sin id o id desconocido: { jugador: null } (entra como nuevo).
//   - exigirLlave = false: basta el id (juegos donde el id no se publica).
//   - exigirLlave = true: además debe pasar `puedeReanudar`; si no: { jugador: null, rechazado: true }.
/**
 * @param {Map<string, any>} jugadores
 * @param {{ id?: string, secreto?: string, userId?: string | null, exigirLlave?: boolean }} [opciones]
 */
export function reanudar(jugadores, { id, secreto, userId, exigirLlave = false } = {}) {
  const jugador = typeof id === "string" && id ? jugadores.get(id) || null : null;
  if (!jugador) return { jugador: null };
  if (exigirLlave && !puedeReanudar(jugador, { secreto, userId })) return { jugador: null, rechazado: true };
  return { jugador };
}
