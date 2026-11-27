// ============================================================================
// SOCKET.IO DE "CRUCIGRAMA RELÁMPAGO"
// ============================================================================
// Cada partida vive en su propia "room" de Socket.IO llamada `cw:<código>`.
// Como cada estudiante tiene su PROPIO tablero, no basta con mandar un solo
// estado a toda la sala: a cada quien se le manda su vista personal (con su
// energía, su racha y sus casillas), y a todos por igual el marcador.
//
// server.js solo necesita 3 líneas para usar esto (ver el comentario al final).
// ============================================================================
import crypto from "node:crypto";
import { nanoid } from "nanoid";
import {
  getRoom,
  addPlayer,
  startRoom,
  endRoom,
  resetRoom,
  submitAnswer,
  useSabotage,
  publicRoomState,
  tick,
  rooms,
} from "./engine.js";

const roomKey = (code) => `cw:${code}`;

// Solo deja pasar si quien llama es el docente dueño de esa partida.
function mismoSecreto(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ¿Puede este socket retomar al jugador `existente`? Sí si trae su llave privada,
// o si es la misma cuenta de estudiante que lo creó.
function puedeRetomar(existente, secret, userId) {
  if (existente.userId && userId && existente.userId === userId) return true;
  return mismoSecreto(secret, existente.secret);
}

function requireOwner(socket, room) {
  const u = socket.data.user;
  if (!u || u.role !== "docente") return "Inicia sesión como docente para controlar esta partida.";
  // Sin dueño (el docente borró su cuenta): nadie la controla; antes podía cualquier docente.
  if (room.ownerId !== u.id)
    return room.ownerId ? "Esta partida pertenece a otro docente." : "Ya no hay un docente a cargo.";
  return null;
}

// Manda a CADA socket conectado a la sala su propia vista (no una sola para todos).
export async function broadcastCrossword(io, code) {
  const room = getRoom(code);
  if (!room) return;
  tick(room);
  let sockets;
  try {
    sockets = await io.in(roomKey(code)).fetchSockets();
  } catch {
    return; // io de prueba sin fetchSockets: no pasa nada, solo no hay eco en vivo
  }
  for (const s of sockets) {
    if (!s.data.cwCode) continue; // ni jugador ni docente observando: no pertenece a esta sala
    s.emit("cw:state", publicRoomState(room, s.data.cwPlayerId || null));
  }
}

// Revisa el reloj de todas las partidas activas (llamarlo 1 vez por segundo desde server.js).
export function crosswordTick(io) {
  for (const code of rooms.keys()) {
    broadcastCrossword(io, code).catch(() => {});
  }
}

export function attachCrosswordSocket(io, socket) {
  // --- El docente observa su propia sala (no juega, solo mira el marcador en vivo) ---
  socket.on("cw:watch-room", ({ code } = {}, ack) => {
    const room = getRoom(String(code || "").trim());
    if (!room) return ack?.({ error: "No existe una partida con ese código." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });

    socket.join(roomKey(room.code));
    socket.data.cwCode = room.code;
    // OJO: a propósito NO se pone socket.data.cwPlayerId: el docente no es un jugador.

    ack?.({ ok: true, state: publicRoomState(room, null) });
  });

  // --- Unirse (y volver a entrar tras recargar la página, con el mismo playerId) ---
  socket.on("cw:join-room", ({ code, playerId, secret, name } = {}, ack) => {
    const room = getRoom(String(code || "").trim());
    if (!room) return ack?.({ error: "No existe una partida con ese código." });

    const userId = socket.data.user?.id || null;
    const existente = typeof playerId === "string" ? room.players.get(playerId) : null;
    // Los ids salen en el marcador: sin la llave privada (o la misma cuenta)
    // no se puede entrar como otro jugador.
    if (existente && !puedeRetomar(existente, secret, userId)) {
      return ack?.({ error: "No se pudo recuperar tu lugar en la partida. Vuelve a unirte con el código." });
    }
    const id = existente ? existente.id : nanoid();
    const { player, error } = addPlayer(room, { id, name, userId });
    if (error) return ack?.({ error });

    // Si el socket ya estaba en otra sala de crucigrama, salir de ella.
    if (socket.data.cwCode && socket.data.cwCode !== room.code) socket.leave(roomKey(socket.data.cwCode));
    socket.join(roomKey(room.code));
    socket.data.cwCode = room.code;
    socket.data.cwPlayerId = player.id;

    ack?.({ ok: true, playerId: player.id, secret: player.secret, state: publicRoomState(room, player.id) });
    broadcastCrossword(io, room.code);
  });

  // --- El docente inicia la partida ---
  socket.on("cw:start", ({ code } = {}, ack) => {
    const room = getRoom(String(code || "").trim());
    if (!room) return ack?.({ error: "No existe esa partida." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });

    const r = startRoom(room);
    if (r.error) return ack?.({ error: r.error });
    ack?.({ ok: true });
    broadcastCrossword(io, room.code);
  });

  // --- El docente termina la partida antes de tiempo ---
  socket.on("cw:end", ({ code } = {}, ack) => {
    const room = getRoom(String(code || "").trim());
    if (!room) return ack?.({ error: "No existe esa partida." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });

    const r = endRoom(room);
    if (r.error) return ack?.({ error: r.error });
    ack?.({ ok: true });
    broadcastCrossword(io, room.code);
  });

  // --- El docente reinicia la partida (mismo código, marcador en cero) ---
  socket.on("cw:reset", ({ code } = {}, ack) => {
    const room = getRoom(String(code || "").trim());
    if (!room) return ack?.({ error: "No existe esa partida." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });

    const r = resetRoom(room);
    if (r.error) return ack?.({ error: r.error });
    ack?.({ ok: true });
    broadcastCrossword(io, room.code);
  });

  // --- Un estudiante responde una palabra ---
  socket.on("cw:submit", ({ placementId, guess } = {}, ack) => {
    const code = socket.data.cwCode;
    const playerId = socket.data.cwPlayerId;
    if (!code || !playerId) return ack?.({ error: "Primero únete a la partida." });
    const room = getRoom(code);
    const r = submitAnswer(room, playerId, Number(placementId), guess);
    ack?.(r);
    if (r.ok) broadcastCrossword(io, code);
  });

  // --- Un estudiante usa un sabotaje contra un rival ---
  socket.on("cw:sabotage", ({ targetId, type } = {}, ack) => {
    const code = socket.data.cwCode;
    const playerId = socket.data.cwPlayerId;
    if (!code || !playerId) return ack?.({ error: "Primero únete a la partida." });
    const room = getRoom(code);
    const r = useSabotage(room, playerId, targetId, type);
    ack?.(r);
    if (r.ok) {
      // Aviso a TODA la sala (cada cliente decide si el sabotaje fue contra él,
      // a favor de él, o de otros dos jugadores, comparando los ids).
      io.to(roomKey(code)).emit("cw:sabotage-used", r);
      broadcastCrossword(io, code);
    }
  });
}

// ----------------------------------------------------------------------------
// Cómo enchufar esto en server.js (solo estas 3 líneas):
//
//   import { crosswordRouter } from "./crossword/routes.js";
//   import { attachCrosswordSocket, crosswordTick } from "./crossword/sockets.js";
//   ...
//   app.use("/api/crossword-games", crosswordRouter);
//   io.on("connection", (socket) => attachCrosswordSocket(io, socket));
//   setInterval(() => crosswordTick(io), 1000);
// ----------------------------------------------------------------------------
