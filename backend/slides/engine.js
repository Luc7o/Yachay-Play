// ============================================================================
// MOTOR DE "PRESENTACIONES EN VIVO"
// ============================================================================
// Igual que el del crucigrama: no sabe nada de Express, Socket.IO ni de la base
// de datos. Solo guarda las salas en memoria y aplica reglas. Para guardar en
// la base se usa el gancho `hooks.onDirty` (ver persist.js).
//
// Una SALA la crea el docente. Cada estudiante entra con el código y obtiene una
// presentación ("deck"):
//   - si NO escribe equipo -> tiene su presentación individual;
//   - si escribe un nombre de equipo -> todos los que escriban el mismo nombre
//     editan la MISMA presentación al mismo tiempo.
// ============================================================================
import crypto from "node:crypto";
import { LIMITES, aplicarOp, deckInicial, limpiarDeck, limpiarOp } from "./model.js";

export const rooms = new Map(); // code -> sala
export const hooks = { onDirty: null };
const avisar = (room) => {
  room.dirty = true;
  try {
    hooks.onDirty?.(room);
  } catch (e) {
    console.error("[presentaciones] gancho falló:", e.message);
  }
};

const MAX_ALUMNOS = 80;
const clave = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
const nombreLimpio = (s, max = LIMITES.nombre) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

export function createRoom({ name, task, ownerId }) {
  let code;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));
  const room = {
    id: crypto.randomUUID(),
    code,
    name: nombreLimpio(name, 60) || "Presentaciones de la clase",
    task: String(task || "").trim().slice(0, 500),
    ownerId: ownerId || null,
    createdAt: Date.now(),
    status: "open", // open | closed
    locked: false, // true = nadie puede editar (solo mirar)
    decks: new Map(), // deckKey -> { key, name, deck, comments, updatedAt }
    students: new Map(), // studentId -> { id, name, userId, deckKey, online, slideId, lastSeen }
    dirty: true,
  };
  rooms.set(code, room);
  avisar(room);
  return room;
}

export const getRoom = (code) => rooms.get(String(code || "").trim()) || null;

export function joinStudent(room, { id, name, team, userId }) {
  const existente = id ? room.students.get(id) : null;
  if (existente) return { student: existente, entry: room.decks.get(existente.deckKey) };
  if (room.status === "closed") return { error: "El docente cerró esta sala." };
  const nombre = nombreLimpio(name, 30);
  if (!nombre) return { error: "Escribe tu nombre." };
  if (room.students.size >= MAX_ALUMNOS) return { error: "La sala está llena." };

  const equipo = nombreLimpio(team, 30);
  const deckKey = equipo ? `t:${clave(equipo)}` : null;
  const sid = id || crypto.randomUUID().slice(0, 12);
  const key = deckKey || `s:${sid}`;
  let entry = room.decks.get(key);
  if (!entry) {
    entry = { key, name: equipo || nombre, deck: deckInicial(), comments: {}, updatedAt: Date.now() };
    room.decks.set(key, entry);
  }
  const student = { id: sid, name: nombre, userId: userId || null, deckKey: key, online: false, slideId: null, lastSeen: Date.now() };
  room.students.set(sid, student);
  avisar(room);
  return { student, entry };
}

// Un estudiante edita SU presentación. Devuelve la operación ya limpia para reenviarla.
export function studentOp(room, studentId, rawOp) {
  const st = room.students.get(studentId);
  if (!st) return { error: "No estás en esta sala." };
  if (room.status === "closed") return { error: "La sala está cerrada." };
  if (room.locked) return { error: "El docente bloqueó la edición por ahora." };
  const op = limpiarOp(rawOp);
  if (!op) return { error: "Cambio no válido." };
  const entry = room.decks.get(st.deckKey);
  entry.deck = aplicarOp(entry.deck, op);
  entry.updatedAt = st.lastSeen = Date.now();
  avisar(room);
  return { op, entry };
}

export function addComment(room, deckKey, slideId, text) {
  const entry = room.decks.get(deckKey);
  const t = String(text || "").trim().slice(0, LIMITES.comentario);
  if (!entry || !t) return null;
  const sid = String(slideId || "").slice(0, 16);
  const lista = (entry.comments[sid] ||= []);
  const c = { text: t, time: Date.now() };
  lista.push(c);
  if (lista.length > 30) lista.shift();
  avisar(room);
  return { sid, comment: c };
}

export function setLocked(room, locked) {
  room.locked = !!locked;
  avisar(room);
}
export function closeRoom(room) {
  room.status = "closed";
  room.locked = true;
  avisar(room);
}

export function setPresence(room, studentId, patch) {
  const st = room.students.get(studentId);
  if (!st) return null;
  Object.assign(st, patch, { lastSeen: Date.now() });
  return st;
}

// ---- lo que ve cada quien ----
const miembros = (room, key) =>
  [...room.students.values()].filter((s) => s.deckKey === key).map((s) => ({ id: s.id, name: s.name, online: s.online, slideId: s.slideId }));

export function resumenSala(room) {
  return { code: room.code, name: room.name, task: room.task, status: room.status, locked: room.locked };
}

// El docente recibe TODAS las presentaciones (para dibujar las miniaturas en vivo).
export function vistaDocente(room) {
  return {
    ...resumenSala(room),
    decks: [...room.decks.values()].map((e) => ({
      key: e.key, name: e.name, deck: e.deck, comments: e.comments, updatedAt: e.updatedAt, members: miembros(room, e.key),
    })),
  };
}

// El estudiante recibe SOLO la suya.
export function vistaEstudiante(room, student) {
  const e = room.decks.get(student.deckKey);
  return { ...resumenSala(room), me: { id: student.id, name: student.name }, deckKey: e.key, deckName: e.name, deck: e.deck, comments: e.comments, members: miembros(room, e.key) };
}

export const miembrosDe = miembros;

// ---- guardado / restauración ----
export function serializar(room) {
  return {
    id: room.id, code: room.code, name: room.name, task: room.task, ownerId: room.ownerId, status: room.status, locked: room.locked,
    createdAt: room.createdAt,
    decks: [...room.decks.values()],
    students: [...room.students.values()].map(({ id, name, userId, deckKey }) => ({ id, name, userId, deckKey })),
  };
}
export function restaurar(d) {
  if (!d?.code || rooms.has(d.code)) return null;
  const room = {
    id: d.id, code: d.code, name: d.name, task: d.task || "", ownerId: d.ownerId || null, status: d.status === "closed" ? "closed" : "open",
    locked: !!d.locked, createdAt: d.createdAt || Date.now(), decks: new Map(), students: new Map(), dirty: false,
  };
  for (const e of d.decks || []) room.decks.set(e.key, { key: e.key, name: e.name, deck: limpiarDeck(e.deck), comments: e.comments || {}, updatedAt: e.updatedAt || Date.now() });
  for (const s of d.students || []) if (room.decks.has(s.deckKey)) room.students.set(s.id, { ...s, online: false, slideId: null, lastSeen: Date.now() });
  rooms.set(room.code, room);
  return room;
}

export function purgeOld(limite) {
  for (const [code, r] of rooms) if (r.createdAt < limite) rooms.delete(code);
}
