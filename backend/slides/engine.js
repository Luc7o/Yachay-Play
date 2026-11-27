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
const nombreLimpio = (s, max = LIMITES.nombre) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function createRoom({ name, task, ownerId, classId = null }) {
  let code;
  do {
    code = String(crypto.randomInt(100000, 1000000)); // crypto: códigos no predecibles
  } while (rooms.has(code));
  const room = {
    id: crypto.randomUUID(),
    code,
    name: nombreLimpio(name, 60) || "Presentaciones de la clase",
    task: String(task || "")
      .trim()
      .slice(0, 500),
    ownerId: ownerId || null,
    classId: classId || null, // clase a la que pertenece (o null)
    createdAt: Date.now(),
    lastUsed: Date.now(), // última vez que el docente abrió la sala (evita sacarla de memoria mientras se usa)
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

// ---- equipos ----
// Antes la "llave" del equipo era su nombre escrito a mano: cualquiera que lo adivinara
// ("grupo 1") entraba y podía borrar la presentación. Ahora quien CREA el equipo recibe
// un código de 4 caracteres que comparte con sus compañeros, y para unirse hay que escribirlo.
const ALFABETO_EQUIPO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I/L, que se confunden
const RE_CODIGO_EQUIPO = /^[A-HJ-NP-Z2-9]{4}$/;
export const limpiarCodigoEquipo = (c) =>
  String(c || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
// El código vive dentro de la clave del deck ("t:ABCD"), así sobrevive a la restauración sin cambiar el guardado.
export const codigoDeEquipo = (key) =>
  typeof key === "string" && key.startsWith("t:") && RE_CODIGO_EQUIPO.test(key.slice(2)) ? key.slice(2) : null;
function nuevoCodigoEquipo(room) {
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += ALFABETO_EQUIPO[crypto.randomInt(ALFABETO_EQUIPO.length)];
    if (!room.decks.has(`t:${c}`)) return c;
  }
}

export function joinStudent(room, { id, name, team, teamCode, userId }) {
  let existente = id ? room.students.get(id) : null;
  // Con cuenta: si ya había entrado a esta sala (aunque sea desde otro dispositivo), recupera SU presentación.
  // No aplica si ahora pide unirse a un equipo (con código o nombre de equipo).
  if (!existente && userId && !teamCode && !team) {
    existente = [...room.students.values()].find((s) => s.userId === userId && room.decks.has(s.deckKey)) || null;
  }
  if (existente) return { student: existente, entry: room.decks.get(existente.deckKey) };
  if (room.status === "closed") return { error: "El docente cerró esta sala." };
  const nombre = nombreLimpio(name, 30);
  if (!nombre) return { error: "Escribe tu nombre." };
  if (room.students.size >= MAX_ALUMNOS) return { error: "La sala está llena." };

  const sid = id || crypto.randomUUID().slice(0, 12);
  const codigo = limpiarCodigoEquipo(teamCode);
  let entry;
  if (codigo) {
    // Unirse a un equipo que ya existe: el código tiene que coincidir.
    entry = RE_CODIGO_EQUIPO.test(codigo) ? room.decks.get(`t:${codigo}`) : null;
    if (!entry)
      return {
        error: "No existe un equipo con ese código en esta sala. Pídeselo a quien creó el equipo.",
        codigoInvalido: true,
      };
  } else {
    const equipo = nombreLimpio(team, 30);
    const key = equipo ? `t:${nuevoCodigoEquipo(room)}` : `s:${sid}`;
    entry = { key, name: equipo || nombre, deck: deckInicial(), comments: {}, updatedAt: Date.now() };
    room.decks.set(key, entry);
  }
  const key = entry.key;
  const student = {
    id: sid,
    name: nombre,
    userId: userId || null,
    deckKey: key,
    online: false,
    slideId: null,
    lastSeen: Date.now(),
  };
  room.students.set(sid, student);
  avisar(room);
  return { student, entry };
}

const MAX_IMAGENES_DECK = 6 * 1024 * 1024; // caracteres de dataURL por presentación (~4,5 MB de imagen)
const MAX_IMAGENES_SALA = 40 * 1024 * 1024; // entre todas las presentaciones de la sala

function pesoImagenes(deck) {
  let total = 0;
  for (const sl of deck?.slides || [])
    for (const el of sl.elements || []) if (el.type === "image" && typeof el.src === "string") total += el.src.length;
  return total;
}
// Solo hace falta medir cuando el cambio puede agregar imágenes (nuevo elemento,
// nueva diapositiva o edición de un elemento); mover o borrar nunca hace crecer.
function opPuedeCrecer(op) {
  return op.t !== "slide-" && op.t !== "el-" && op.t !== "slide>";
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
  const nuevo = aplicarOp(entry.deck, op);
  // Tope de memoria: las imágenes viajan como dataURL dentro del deck, y sin límite
  // total un estudiante podría subir cientos de MB (40 diapositivas × 60 imágenes).
  if (nuevo !== entry.deck && opPuedeCrecer(op)) {
    const delDeck = pesoImagenes(nuevo);
    if (delDeck > MAX_IMAGENES_DECK)
      return { error: "La presentación ya tiene demasiadas imágenes. Quita alguna o usa imágenes más livianas." };
    let deLaSala = delDeck;
    for (const e of room.decks.values()) if (e !== entry) deLaSala += pesoImagenes(e.deck);
    if (deLaSala > MAX_IMAGENES_SALA)
      return { error: "La sala llegó a su límite de imágenes. Pide al docente que revise." };
  }
  entry.deck = nuevo;
  entry.updatedAt = st.lastSeen = Date.now();
  avisar(room);
  return { op, entry };
}

export function addComment(room, deckKey, slideId, text) {
  const entry = room.decks.get(deckKey);
  const t = String(text || "")
    .trim()
    .slice(0, LIMITES.comentario);
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
// El docente vuelve a abrir una sala cerrada (para continuar el trabajo en la siguiente clase).
export function reopenRoom(room) {
  room.status = "open";
  room.locked = false;
  room.lastUsed = Date.now();
  avisar(room);
}

// Elimina la sala de la memoria. La marca `deleted` evita que el guardado automático la vuelva a escribir en la base.
export function deleteRoom(room) {
  room.deleted = true;
  if (rooms.get(room.code) === room) rooms.delete(room.code);
}
export const marcarUso = (room) => {
  room.lastUsed = Date.now();
};

// Resumen corto para la lista "Mis salas" del docente.
export function resumenLista(room) {
  let slides = 0;
  for (const e of room.decks.values()) slides += e.deck?.slides?.length || 0;
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    task: room.task,
    status: room.status,
    createdAt: room.createdAt,
    students: room.students.size,
    decks: room.decks.size,
    slides,
  };
}

export function setPresence(room, studentId, patch) {
  const st = room.students.get(studentId);
  if (!st) return null;
  Object.assign(st, patch, { lastSeen: Date.now() });
  return st;
}

// ---- lo que ve cada quien ----
const miembros = (room, key) =>
  [...room.students.values()]
    .filter((s) => s.deckKey === key)
    .map((s) => ({ id: s.id, name: s.name, online: s.online, slideId: s.slideId }));

export function resumenSala(room) {
  return { code: room.code, name: room.name, task: room.task, status: room.status, locked: room.locked };
}

// El docente recibe TODAS las presentaciones (para dibujar las miniaturas en vivo).
export function vistaDocente(room) {
  return {
    ...resumenSala(room),
    id: room.id,
    decks: [...room.decks.values()].map((e) => ({
      key: e.key,
      name: e.name,
      teamCode: codigoDeEquipo(e.key),
      deck: e.deck,
      comments: e.comments,
      updatedAt: e.updatedAt,
      members: miembros(room, e.key),
    })),
  };
}

// El estudiante recibe SOLO la suya.
export function vistaEstudiante(room, student) {
  const e = room.decks.get(student.deckKey);
  return {
    ...resumenSala(room),
    me: { id: student.id, name: student.name },
    deckKey: e.key,
    deckName: e.name,
    teamCode: codigoDeEquipo(e.key),
    deck: e.deck,
    comments: e.comments,
    members: miembros(room, e.key),
  };
}

export const miembrosDe = miembros;

// ---- guardado / restauración ----
export function serializar(room) {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    task: room.task,
    ownerId: room.ownerId,
    classId: room.classId || null,
    status: room.status,
    locked: room.locked,
    createdAt: room.createdAt,
    decks: [...room.decks.values()],
    students: [...room.students.values()].map(({ id, name, userId, deckKey }) => ({ id, name, userId, deckKey })),
  };
}
export function restaurar(d) {
  if (!d?.code || rooms.has(d.code)) return null;
  const room = {
    id: d.id,
    code: d.code,
    name: d.name,
    task: d.task || "",
    ownerId: d.ownerId || null,
    classId: d.classId || null,
    status: d.status === "closed" ? "closed" : "open",
    locked: !!d.locked,
    createdAt: d.createdAt || Date.now(),
    lastUsed: Date.now(),
    decks: new Map(),
    students: new Map(),
    dirty: false,
  };
  for (const e of d.decks || [])
    room.decks.set(e.key, {
      key: e.key,
      name: e.name,
      deck: limpiarDeck(e.deck),
      comments: e.comments || {},
      updatedAt: e.updatedAt || Date.now(),
    });
  for (const s of d.students || [])
    if (room.decks.has(s.deckKey))
      room.students.set(s.id, { ...s, online: false, slideId: null, lastSeen: Date.now() });
  rooms.set(room.code, room);
  return room;
}

// Saca de la memoria las salas sin uso. Una sala sigue "en uso" si se creó, la abrió el docente
// o algún estudiante hizo algo después del límite. (Siguen guardadas en la base y salen en "Mis salas".)
export function purgeOld(limite) {
  for (const [code, r] of rooms) {
    let ultimo = Math.max(r.createdAt || 0, r.lastUsed || 0);
    for (const s of r.students.values()) ultimo = Math.max(ultimo, s.lastSeen || 0);
    if (ultimo < limite) rooms.delete(code);
  }
}
