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

const key = (code) => `qz:${code}`;

function requireOwner(socket, room) {
  const u = socket.data.user;
  if (!u || u.role !== "docente") return "Inicia sesión como docente para controlar esta evaluación.";
  // Sin dueño (el docente borró su cuenta): nadie la controla; antes podía cualquier docente.
  if (room.ownerId !== u.id)
    return room.ownerId ? "Esta evaluación pertenece a otro docente." : "Ya no hay un docente a cargo.";
  return null;
}

export async function broadcastQuiz(io, code) {
  const room = getRoom(code);
  if (!room) return;
  tick(room);
  let sockets;
  try {
    sockets = await io.in(key(code)).fetchSockets();
  } catch {
    return;
  }
  for (const s of sockets) {
    if (s.data.qzCode !== code) continue;
    s.emit("qz:state", publicState(room, s.data.qzPlayerId || null, !!s.data.qzTeacher));
  }
}

export function quizTick(io) {
  for (const code of rooms.keys()) broadcastQuiz(io, code).catch(() => {});
}

export function attachQuizSocket(io, socket) {
  // Atajo para los eventos del docente: valida sala y dueño, ejecuta y avisa a todos.
  const docente = (evento, accion) =>
    socket.on(evento, ({ code } = {}, ack) => {
      const room = getRoom(code);
      if (!room) return ack?.({ error: "No existe esa evaluación." });
      const problema = requireOwner(socket, room);
      if (problema) return ack?.({ error: problema });
      const r = accion(room);
      if (r?.error) return ack?.({ error: r.error });
      ack?.({ ok: true, ...(r || {}) });
      broadcastQuiz(io, room.code);
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

  docente("qz:start", start);
  docente("qz:next", next);
  docente("qz:reveal", reveal);
  docente("qz:end", end);

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
