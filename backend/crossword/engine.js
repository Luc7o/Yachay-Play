// ============================================================================
// MOTOR DE "CRUCIGRAMA RELÁMPAGO"
// ============================================================================
// Cada estudiante tiene SU PROPIO tablero (mismas palabras y mismo diseño para
// todos, pero cada quien lo llena por su cuenta): es una carrera. Al acertar
// rápido y en racha se junta ENERGÍA, que se puede gastar en sabotajes contra
// un rival. Todo vive en memoria (Map), igual que las partidas de Ludo.
//
// Este archivo NO sabe nada de Express ni de Socket.IO a propósito: así se
// puede probar la lógica sola, sin encender ningún servidor.
// ============================================================================
import crypto from "node:crypto";
import { generateCrossword } from "./generate.js";
import { DEFAULT_WORDS, normalizeAnswer } from "./words.js";

export const rooms = new Map(); // code -> room

// ------------------------- ganchos de persistencia -------------------------
// El motor sigue sin saber nada de bases de datos: solo avisa "pasó esto" y, si
// alguien registró un gancho (ver persist.js), lo llama. Si el gancho falla, el
// juego NO se entera: guardar nunca debe romper una partida en vivo.
export const hooks = { onCreate: null, onPlayer: null, onStart: null, onClose: null, onReset: null };
function avisar(nombre, ...args) {
  try {
    hooks[nombre]?.(...args);
  } catch (e) {
    console.error(`[crucigrama] gancho ${nombre} falló:`, e.message);
  }
}

// ------------------------------- ajustes -------------------------------
const WRONG_COOLDOWN_MS = 3000; // tras fallar, no puede reintentar esa palabra por 3s
const STREAK_CAP = 5; // la racha deja de dar más energía/puntos extra después de 5

export const SABOTAGES = {
  freeze: { cost: 35, label: "Congelar", desc: "El rival no puede responder por 5 s.", durationMs: 5000 },
  fog: { cost: 25, label: "Niebla", desc: "Le ocultas sus pistas por 6 s.", durationMs: 6000 },
  steal: { cost: 50, label: "Robar puntos", desc: "Le quitas hasta 40 puntos.", stealAmount: 40 },
};

function code6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// -------------------------- historial de actividad --------------------------
// Fila de eventos legible para el docente: quién saboteó a quién, quién se
// unió, quién terminó... Nunca incluye respuestas ni nada que un estudiante
// no pueda ya ver por su cuenta.
function pushLog(room, text, type = "info") {
  room.log.push({ id: ++room.logSeq, time: Date.now(), text, type });
  if (room.log.length > 200) room.log.splice(0, room.log.length - 200); // no crece sin límite
}

// --------------------------------- sala ---------------------------------
export function createRoom({ name, ownerId, minutes = 8, wordCount = 12 }) {
  const bank = shuffle(DEFAULT_WORDS).slice(0, Math.max(6, Math.min(wordCount, DEFAULT_WORDS.length)));
  const grid = generateCrossword(bank);
  let code;
  do {
    code = code6();
  } while (rooms.has(code));

  const room = {
    id: crypto.randomUUID(),
    code,
    name: (name || "Crucigrama Relámpago").trim().slice(0, 60),
    ownerId,
    minutes,
    grid, // incluye placements con `word` real (NO se manda entero al estudiante)
    status: "lobby", // lobby -> playing -> ended
    endReason: null, // por qué terminó: "completed" (alguien completó todo) | "time" | "teacher"
    winnerId: null, // ganador: quien completó primero, o (si no lo completó nadie) quien tenga más puntos
    startedAt: null,
    endsAt: null,
    players: new Map(), // playerId -> jugador
    createdAt: Date.now(),
    log: [],
    logSeq: 0,
  };
  rooms.set(code, room);
  avisar("onCreate", room);
  return room;
}

// Reconstruye una sala guardada en la base de datos (tras reiniciar el servidor).
// Vuelve a la sala de espera: el avance de la ronda en curso no se guarda.
export function restoreRoom({ id, code, name, ownerId, minutes, grid, players = [] }) {
  if (rooms.has(code)) return rooms.get(code);
  const room = {
    id,
    code,
    name,
    ownerId,
    minutes,
    grid,
    status: "lobby",
    endReason: null,
    winnerId: null,
    startedAt: null,
    endsAt: null,
    players: new Map(),
    createdAt: Date.now(),
    log: [],
    logSeq: 0,
  };
  for (const p of players) room.players.set(p.id, nuevoJugador(p.id, p.name, p.userId));
  rooms.set(code, room);
  return room;
}

// Quita de la memoria las salas creadas antes de `limiteMs` (timestamp).
export function purgeOldRooms(limiteMs) {
  for (const [code, room] of rooms) if (room.createdAt < limiteMs) rooms.delete(code);
}

export function getRoom(code) {
  return rooms.get(code) || null;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -------------------------------- jugador --------------------------------
function nuevoJugador(id, name, userId = null) {
  return {
    id,
    name,
    userId, // cuenta del estudiante (null si entró como invitado)
    score: 0,
    lastPointAt: 0, // cuándo sumó puntos por última vez: sirve de desempate
    streak: 0,
    energy: 0,
    solved: new Set(), // ids de placements ya resueltos por ESTE jugador
    cooldowns: new Map(), // placementId -> timestamp hasta el que no puede reintentar
    frozenUntil: 0,
    fogUntil: 0,
    finishedAt: null,
    finishRank: null,
    joinedAt: Date.now(),
  };
}

export function addPlayer(room, { id, name, userId = null }) {
  if (!room) return { error: "La partida no existe." };
  if (room.status === "ended") return { error: "Esa partida ya terminó." };
  const limpio = String(name || "").trim().slice(0, 30);
  if (!limpio) return { error: "Escribe tu nombre." };
  if (!room.players.has(id)) {
    room.players.set(id, nuevoJugador(id, limpio, userId));
    avisar("onPlayer", room, room.players.get(id));
    pushLog(room, `👋 ${limpio} se unió a la partida.`, "join");
  }
  return { player: room.players.get(id) };
}

// Orden de la tabla por puntaje. Si hay empate en puntos, gana quien llegó primero
// a ese puntaje (el que sumó sus últimos puntos antes).
function byScore(a, b) {
  return b.score - a.score || a.lastPointAt - b.lastPointAt;
}

// ÚNICO lugar donde se cierra una partida. Decide el ganador según el motivo:
//   "completed" -> gana quien completó TODO el crucigrama primero (winnerId viene dado)
//   "time" / "teacher" -> nadie completó: gana quien tenga MÁS PUNTOS
// Si nadie sumó ni un punto, no hay ganador (winnerId queda en null).
function closeRoom(room, reason, forcedWinnerId = null) {
  if (room.status === "ended") return;
  room.status = "ended";
  room.endReason = reason;

  if (forcedWinnerId) {
    room.winnerId = forcedWinnerId;
    avisar("onClose", room);
    return;
  }
  const top = [...room.players.values()].sort(byScore)[0];
  room.winnerId = top && top.score > 0 ? top.id : null;

  if (room.winnerId) {
    pushLog(room, `🏆 ${top.name} ganó la partida con más puntos (${top.score} pts).`, "finish");
  } else {
    pushLog(room, "🤝 Terminó la partida sin ganador: nadie sumó puntos.", "finish");
  }
  avisar("onClose", room);
}

export function startRoom(room, now = Date.now()) {
  if (!room) return { error: "La partida no existe." };
  if (room.players.size === 0) return { error: "Nadie se ha unido todavía." };
  room.status = "playing";
  room.startedAt = now;
  room.endsAt = now + room.minutes * 60 * 1000;
  pushLog(room, "▶️ El docente inició la partida.");
  avisar("onStart", room);
  return { ok: true };
}

// El docente corta la partida antes de tiempo (todos ven resultados ya).
export function endRoom(room) {
  if (!room) return { error: "La partida no existe." };
  if (room.status === "ended") return { ok: true };
  pushLog(room, "🏁 El docente finalizó la partida.");
  closeRoom(room, "teacher");
  return { ok: true };
}

// Vuelve todo a cero (mismo código, mismos jugadores, mismo crucigrama) para
// jugar otra ronda sin que los estudiantes tengan que volver a escribir el
// código.
export function resetRoom(room) {
  if (!room) return { error: "La partida no existe." };
  room.status = "lobby";
  room.endReason = null;
  room.winnerId = null;
  room.startedAt = null;
  room.endsAt = null;
  for (const p of room.players.values()) {
    p.score = 0;
    p.lastPointAt = 0;
    p.streak = 0;
    p.energy = 0;
    p.solved = new Set();
    p.cooldowns = new Map();
    p.frozenUntil = 0;
    p.fogUntil = 0;
    p.finishedAt = null;
    p.finishRank = null;
  }
  pushLog(room, "🔄 El docente reinició la partida: todos vuelven a la sala de espera.");
  avisar("onReset", room);
  return { ok: true };
}

// Cierra la sala si ya se acabó el tiempo. Se llama antes de leer/actuar sobre la sala.
export function tick(room, now = Date.now()) {
  if (room && room.status === "playing" && now >= room.endsAt) {
    pushLog(room, "⏰ Se acabó el tiempo.");
    closeRoom(room, "time");
  }
  return room;
}

// ------------------------------ responder ------------------------------
export function submitAnswer(room, playerId, placementId, guess, now = Date.now()) {
  tick(room, now);
  if (!room || room.status !== "playing") return { error: "La partida no está en curso." };
  const player = room.players.get(playerId);
  if (!player) return { error: "No estás en esta partida." };
  const placement = room.grid.placements.find((p) => p.id === placementId);
  if (!placement) return { error: "Esa palabra no existe." };

  if (player.frozenUntil > now) {
    return { error: "congelado", frozenUntil: player.frozenUntil };
  }
  if (player.solved.has(placementId)) {
    return { error: "Ya resolviste esa palabra." };
  }
  const espera = player.cooldowns.get(placementId);
  if (espera && espera > now) {
    return { error: "espera", until: espera };
  }

  const acierto = normalizeAnswer(guess) === placement.word;

  if (!acierto) {
    player.streak = 0;
    player.cooldowns.set(placementId, now + WRONG_COOLDOWN_MS);
    return { ok: true, correct: false, cooldownUntil: now + WRONG_COOLDOWN_MS };
  }

  // --- acierto: puntos + racha + energía ---
  player.streak = Math.min(player.streak + 1, STREAK_CAP);
  const puntosBase = 100 + placement.length * 5;
  const bonusRacha = (player.streak - 1) * 10;
  const puntos = puntosBase + bonusRacha;
  player.score += puntos;
  player.lastPointAt = now;
  player.energy = Math.min(100, player.energy + 15 + player.streak * 5);
  player.solved.add(placementId);
  player.cooldowns.delete(placementId);

  const total = room.grid.placements.length;
  let finishBonus = 0;
  let rank = null;
  if (player.solved.size === total && !player.finishedAt) {
    player.finishedAt = now;
    const yaTerminaron = [...room.players.values()].filter((p) => p.finishedAt && p.id !== player.id).length;
    rank = yaTerminaron + 1;
    player.finishRank = rank;
    finishBonus = rank === 1 ? 250 : rank === 2 ? 120 : 60;
    player.score += finishBonus;
    pushLog(room, `🏁 ${player.name} completó el crucigrama.`, "finish");

    // ¡Carrera terminada! El primero que completa TODO el crucigrama gana y la
    // partida se cierra en ese instante para todos (no hace falta esperar al reloj).
    pushLog(room, `🏆 ${player.name} ganó la partida por completar el crucigrama primero.`, "finish");
    closeRoom(room, "completed", player.id);
  }

  return {
    ok: true,
    correct: true,
    points: puntos,
    streak: player.streak,
    energy: player.energy,
    completedAll: player.solved.size === total,
    finishBonus,
    finishRank: rank,
  };
}

// ------------------------------ sabotaje ------------------------------
export function useSabotage(room, sourceId, targetId, type, now = Date.now()) {
  tick(room, now);
  if (!room || room.status !== "playing") return { error: "La partida no está en curso." };
  if (sourceId === targetId) return { error: "No puedes sabotearte a ti mismo." };
  const cfg = SABOTAGES[type];
  if (!cfg) return { error: "Ese sabotaje no existe." };
  const source = room.players.get(sourceId);
  const target = room.players.get(targetId);
  if (!source || !target) return { error: "Jugador no encontrado." };
  if (target.finishedAt) return { error: "Ese rival ya terminó; ya no se le puede sabotear." };
  if (source.energy < cfg.cost) return { error: "No tienes suficiente energía todavía." };

  source.energy -= cfg.cost;
  const result = { ok: true, type, targetId, sourceId };

  if (type === "freeze") {
    target.frozenUntil = Math.max(target.frozenUntil, now) + cfg.durationMs;
    result.until = target.frozenUntil;
    pushLog(room, `🧊 ${source.name} congeló a ${target.name} por ${Math.round(cfg.durationMs / 1000)}s.`, "sabotage");
  } else if (type === "fog") {
    target.fogUntil = Math.max(target.fogUntil, now) + cfg.durationMs;
    result.until = target.fogUntil;
    pushLog(room, `🌫️ ${source.name} le lanzó niebla a ${target.name}.`, "sabotage");
  } else if (type === "steal") {
    const robado = Math.min(cfg.stealAmount, target.score);
    target.score -= robado;
    source.score += robado;
    if (robado > 0) source.lastPointAt = now;
    result.stolen = robado;
    pushLog(room, `💰 ${source.name} robó ${robado} pts a ${target.name}.`, "sabotage");
  }
  return result;
}

// -------------------------- estado hacia el frontend --------------------------
// OJO: nunca se manda la letra/palabra correcta de un rival, ni sus casillas
// llenas; solo su avance en % y su puntaje, para que sea una carrera limpia
// y nadie pueda "copiarse" mirando el tablero de otro.
export function publicRoomState(room, forPlayerId, now = Date.now()) {
  tick(room, now);
  const total = room.grid.placements.length;

  // Cuántos jugadores (de cualquiera) ya resolvieron cada palabra. Sirve para que
  // el docente vea, en vivo, qué tan fácil o difícil está resultando cada pista
  // (nunca se manda la respuesta en sí, solo el conteo).
  const solvedCount = {};
  for (const p of room.players.values()) {
    for (const placementId of p.solved) {
      solvedCount[placementId] = (solvedCount[placementId] || 0) + 1;
    }
  }
  const totalJugadores = room.players.size;
  const clues = room.grid.placements.map(({ word, id, ...pub }) => ({
    id,
    ...pub,
    solvedCount: solvedCount[id] || 0,
    // La respuesta SOLO se manda cuando el 100% de los jugadores conectados
    // ya la acertó (ahí ya no hay nada que "copiar": todos la saben). Si
    // falta aunque sea uno, esta propiedad ni siquiera existe en el objeto.
    ...(totalJugadores > 0 && solvedCount[id] === totalJugadores ? { revealedWord: word } : {}),
  })); // sin la respuesta, salvo el caso de arriba

  // El ganador siempre va primero (si completó el crucigrama puede no ser quien
  // más puntos tiene); el resto se ordena por puntaje, con desempate por quién
  // llegó antes a ese puntaje. Se ordena ANTES de transformar, porque
  // `lastPointAt` es interno y no se manda al frontend.
  const leaderboard = [...room.players.values()]
    .sort((a, b) => (b.id === room.winnerId) - (a.id === room.winnerId) || byScore(a, b))
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      progress: total ? Math.round((p.solved.size / total) * 100) : 0,
      finished: !!p.finishedAt,
      finishRank: p.finishRank,
    }));

  const me = room.players.get(forPlayerId) || null;

  return {
    code: room.code,
    name: room.name,
    status: room.status,
    endReason: room.endReason,
    winnerId: room.winnerId,
    minutes: room.minutes,
    endsAt: room.endsAt,
    grid: { width: room.grid.width, height: room.grid.height },
    clues, // { id, number, row, col, dir, length, clue } — sin respuestas
    sabotages: SABOTAGES,
    leaderboard,
    log: room.log.slice(-25).reverse(), // más reciente primero
    me: me && {
      id: me.id,
      name: me.name,
      score: me.score,
      streak: me.streak,
      energy: me.energy,
      // Las palabras que YA resolvió, con su propia respuesta: sirve para
      // redibujar su tablero si recarga la página, y para pintar la letra en
      // el momento mismo de acertar. Esto NUNCA se manda de un rival, solo de
      // uno mismo (por eso vive dentro de "me").
      solvedWords: [...me.solved].map((id) => {
        const p = room.grid.placements.find((pl) => pl.id === id);
        return { placementId: id, word: p.word };
      }),
      frozenUntil: me.frozenUntil > now ? me.frozenUntil : 0,
      fogUntil: me.fogUntil > now ? me.fogUntil : 0,
      finished: !!me.finishedAt,
      finishRank: me.finishRank,
    },
  };
}
