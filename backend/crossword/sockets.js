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
import { crearGuardDueno, crearAccionesDeAnfitrion } from "../live/dueno.js";
import { enviarVistas } from "../live/difusion.js";
import { reanudar } from "../live/jugadores.js";

const roomKey = (code) => `cw:${code}`;

// Solo deja pasar si quien llama es el docente dueño de esa partida (ver live/dueno.js).
const problemaDeDueno = crearGuardDueno({
  sinSesion: "Inicia sesión como docente para controlar esta partida.",
  otro: "Esta partida pertenece a otro docente.",
  sinDueno: "Ya no hay un docente a cargo.",
});
const requireOwner = (socket, room) => problemaDeDueno(socket.data.user, room);

// Manda a CADA socket conectado a la sala su propia vista (no una sola para todos).
export async function broadcastCrossword(io, code) {
  const room = getRoom(code);
  if (!room) return;
  tick(room);
  await enviarVistas(io, roomKey(code), {
    evento: "cw:state",
    pertenece: (data) => !!data.cwCode, // ni jugador ni docente observando: no pertenece a esta sala
    vista: (data) => publicRoomState(room, data.cwPlayerId || null),
  });
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
    const room = getRoom(code);
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
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe una partida con ese código." });

    const userId = socket.data.user?.id || null;
    // Los ids salen en el marcador: sin la llave privada (o la misma cuenta)
    // no se puede entrar como otro jugador.
    const { jugador: existente, rechazado } = reanudar(room.players, {
      id: playerId,
      secreto: secret,
      userId,
      exigirLlave: true,
    });
    if (rechazado) {
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

  // --- Acciones del docente dueño: iniciar, terminar antes de tiempo y reiniciar ---
  // (startRoom/endRoom/resetRoom devuelven { ok: true } o { error }: el ack es el mismo de antes)
  const docente = crearAccionesDeAnfitrion(socket, {
    buscar: ({ code }) => getRoom(code),
    noExiste: "No existe esa partida.",
    problema: (room) => requireOwner(socket, room),
    despues: (room) => broadcastCrossword(io, room.code),
  });
  docente("cw:start", (room) => startRoom(room));
  docente("cw:end", (room) => endRoom(room));
  docente("cw:reset", (room) => resetRoom(room)); // mismo código, marcador en cero

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
//   reloj.registrar("crucigrama", 1000, () => crosswordTick(io)); // reloj único (live/reloj.js)
// ----------------------------------------------------------------------------
