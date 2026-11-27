// ============================================================================
// SOCKET.IO DE "EVALUACIÓN RÁPIDA" (eventos "qz:*")
// Cada sala es una room de Socket.IO llamada `qz:<código>`. A cada socket se le
// manda SU vista (el docente ve más cosas; el estudiante nunca ve la respuesta
// correcta antes de que se cierre la pregunta).
// ============================================================================
import {
  getRoom,
  addPlayer,
  start,
  next,
  reveal,
  end,
  answer,
  tick,
  publicState,
  exportRows,
  rooms,
} from "./engine.js";
import { crearGuardDueno, crearAccionesDeAnfitrion } from "../live/dueno.js";
import { enviarVistas } from "../live/difusion.js";

const key = (code) => `qz:${code}`;

// Solo el docente que creó la evaluación la controla (ver live/dueno.js).
const problemaDeDueno = crearGuardDueno({
  sinSesion: "Inicia sesión como docente para controlar esta evaluación.",
  otro: "Esta evaluación pertenece a otro docente.",
  sinDueno: "Ya no hay un docente a cargo.",
});
const requireOwner = (socket, room) => problemaDeDueno(socket.data.user, room);

export async function broadcastQuiz(io, code) {
  const room = getRoom(code);
  if (!room) return;
  tick(room);
  await enviarVistas(io, key(code), {
    evento: "qz:state",
    pertenece: (data) => data.qzCode === code,
    vista: (data) => publicState(room, data.qzPlayerId || null, !!data.qzTeacher),
  });
}

export function quizTick(io) {
  for (const code of rooms.keys()) broadcastQuiz(io, code).catch(() => {});
}

export function attachQuizSocket(io, socket) {
  // Atajo para los eventos del docente: valida sala y dueño, ejecuta y avisa a todos.
  const docente = crearAccionesDeAnfitrion(socket, {
    buscar: ({ code }) => getRoom(code),
    noExiste: "No existe esa evaluación.",
    problema: (room) => requireOwner(socket, room),
    despues: (room) => broadcastQuiz(io, room.code),
  });

  socket.on("qz:watch", ({ code } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe una evaluación con ese código." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });
    socket.join(key(room.code));
    socket.data.qzCode = room.code;
    socket.data.qzTeacher = true;
    ack?.({ ok: true, state: publicState(room, null, true) });
  });

  socket.on("qz:join", ({ code, playerId, name } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe una evaluación con ese código." });
    const { player, error } = addPlayer(room, { id: playerId, name });
    if (error) return ack?.({ error });
    socket.join(key(room.code));
    socket.data.qzCode = room.code;
    socket.data.qzPlayerId = player.id;
    socket.data.qzTeacher = false;
    ack?.({ ok: true, playerId: player.id, state: publicState(room, player.id, false) });
    broadcastQuiz(io, room.code);
  });

  docente("qz:start", (room) => start(room));
  docente("qz:next", (room) => next(room));
  docente("qz:reveal", (room) => reveal(room));
  docente("qz:end", (room) => end(room));

  socket.on("qz:export", ({ code } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe esa evaluación." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });
    ack?.({ ok: true, rows: exportRows(room), name: room.name });
  });

  socket.on("qz:answer", ({ choice } = {}, ack) => {
    const code = socket.data.qzCode;
    const playerId = socket.data.qzPlayerId;
    if (!code || !playerId) return ack?.({ error: "Primero únete a la evaluación." });
    const room = getRoom(code);
    if (!room) return ack?.({ error: "La evaluación ya no existe." });
    const r = answer(room, playerId, choice);
    ack?.(r);
    if (r.ok) broadcastQuiz(io, code);
  });
}
