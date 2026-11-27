// ============================================================================
// SOCKET.IO DE "PALABRA RELÁMPAGO" (eventos "pr:*")
// Cada sala es una room de Socket.IO llamada `pr:<código>`.
// ============================================================================
import {
  getRoom,
  addPlayer,
  removePlayer,
  setTeam,
  start,
  end,
  submit,
  skip,
  setTyping,
  tick,
  publicState,
  rooms,
} from "./engine.js";
import { esDueno, crearAccionesDeAnfitrion } from "../live/dueno.js";
import { enviarVistas } from "../live/difusion.js";

const key = (code) => `pr:${code}`;
// Aquí puede crear salas cualquiera con sesión (también estudiantes): basta ser el dueño.
const esAnfitrion = (socket, room) => esDueno(socket.data.user, room, { requiereDocente: false });

export async function broadcastPalabra(io, code) {
  const room = getRoom(code);
  if (!room) return;
  tick(room);
  await enviarVistas(io, key(code), {
    evento: "pr:state",
    pertenece: (data) => data.prCode === code,
    vista: (data) => publicState(room, data.prPlayerId || null, !!data.prHost),
  });
}

export function palabraTick(io) {
  for (const code of rooms.keys()) broadcastPalabra(io, code).catch(() => {});
}

/**
 * @param {import("../tipos").ServidorApp} io
 * @param {import("../tipos").SocketApp} socket
 */
export function attachPalabraSocket(io, socket) {
  // Anfitrión que NO juega (docente): mira y controla.
  socket.on("pr:watch", ({ code } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe una partida con ese código." });
    if (!esAnfitrion(socket, room)) return ack?.({ error: "Solo quien creó la partida puede controlarla." });
    socket.join(key(room.code));
    socket.data.prCode = room.code;
    socket.data.prHost = true;
    ack?.({ ok: true, state: publicState(room, socket.data.prPlayerId || null, true) });
  });

  socket.on("pr:join", ({ code, playerId, name } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe una partida con ese código." });
    const { player, error } = addPlayer(room, { id: playerId, name, userId: socket.data.user?.id || null });
    if (error) return ack?.({ error });
    socket.join(key(room.code));
    socket.data.prCode = room.code;
    socket.data.prPlayerId = player.id;
    socket.data.prHost = esAnfitrion(socket, room);
    ack?.({ ok: true, playerId: player.id, state: publicState(room, player.id, socket.data.prHost) });
    broadcastPalabra(io, room.code);
  });

  socket.on("pr:leave", (_d, ack) => {
    const room = getRoom(socket.data.prCode);
    if (room && socket.data.prPlayerId) removePlayer(room, socket.data.prPlayerId);
    if (room) socket.leave(key(room.code));
    const code = socket.data.prCode;
    socket.data.prCode = null;
    socket.data.prPlayerId = null;
    socket.data.prHost = false;
    ack?.({ ok: true });
    if (room) broadcastPalabra(io, code);
  });

  socket.on("pr:team", ({ team } = {}, ack) => {
    const room = getRoom(socket.data.prCode);
    if (!room || !socket.data.prPlayerId) return ack?.({ error: "Primero únete a la partida." });
    const r = setTeam(room, socket.data.prPlayerId, team);
    ack?.(r);
    if (r.ok) broadcastPalabra(io, room.code);
  });

  const anfitrion = crearAccionesDeAnfitrion(socket, {
    buscar: () => getRoom(socket.data.prCode),
    noExiste: "No existe la partida.",
    problema: (room) => (esAnfitrion(socket, room) ? null : "Solo quien creó la partida puede hacerlo."),
    despues: (room) => broadcastPalabra(io, room.code),
  });
  anfitrion("pr:start", (room) => start(room));
  anfitrion("pr:end", (room) => end(room));

  socket.on("pr:submit", ({ word } = {}, ack) => {
    const room = getRoom(socket.data.prCode);
    if (!room || !socket.data.prPlayerId) return ack?.({ error: "Primero únete a la partida." });
    const r = submit(room, socket.data.prPlayerId, word);
    ack?.(r);
    if (r.ok) broadcastPalabra(io, room.code);
  });

  socket.on("pr:skip", (_d, ack) => {
    const room = getRoom(socket.data.prCode);
    if (!room || !socket.data.prPlayerId) return ack?.({ error: "Primero únete a la partida." });
    const r = skip(room, socket.data.prPlayerId);
    ack?.(r);
    if (r.ok) broadcastPalabra(io, room.code);
  });

  // Lo que va escribiendo quien tiene el turno (lo ven los demás en vivo).
  socket.on("pr:typing", ({ text } = {}) => {
    const room = getRoom(socket.data.prCode);
    if (!room || !socket.data.prPlayerId) return;
    if (setTyping(room, socket.data.prPlayerId, text))
      socket.to(key(room.code)).emit("pr:typing", { n: room.turn.n, text: room.typing });
  });
}
