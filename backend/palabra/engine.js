// ============================================================================
// MOTOR DE "PALABRA RELÁMPAGO" EN LÍNEA
// ============================================================================
// Varias personas juegan cada una desde su dispositivo. El SERVIDOR manda: él
// valida las palabras, lleva el reloj y decide de quién es el turno, así que
// nadie puede hacer trampa desde el navegador.
//
// Flujo de una sala:  lobby -> turn -> result -> turn -> result ... -> ended
//   - Modalidad "individual": cada persona juega por sí misma (3 vidas cada una).
//   - Modalidad "equipos": las personas eligen equipo en la sala de espera; el equipo
//     tiene 3 vidas y, turno tras turno, responde un integrante distinto.
//   - Acertar suma 10 + los segundos que sobraban. Se acaba el tiempo o se pasa:
//     −1 vida. Quien queda sin vidas sale. Termina cuando queda 1 participante o
//     se llega al máximo de turnos.
// Todo vive en memoria (Map) y este archivo NO sabe nada de Express ni Socket.IO.
// ============================================================================
import crypto from "node:crypto";
import { checkWord, candidateFragments, normalizeWord, safeWord } from "./diccionario.js";

export const rooms = new Map(); // code -> room

export const LIMITS = { maxPlayers: 40, minTeams: 2, maxTeams: 4, minSeconds: 10, maxSeconds: 60, minRounds: 6, maxRounds: 120, maxExtraWords: 3000, maxOpenPerOwner: 5 };
export const LIVES = 3;
const RESULT_MS = 1800; // pausa para mostrar qué pasó antes del siguiente turno
const GRACE_MS = 400; // tolerancia por la demora de la red
const COLORS = ["#17c7b5", "#4388ff", "#b18aff", "#ffc15d", "#f383a6", "#6ac9de", "#a4d75c", "#e1a7ff"];
const TEAM_NAMES = ["Equipo Menta", "Equipo Azul", "Equipo Violeta", "Equipo Ámbar"];

const code6 = () => String(crypto.randomInt(100000, 1000000));
const clean = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const clamp = (v, lo, hi, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

export function openRoomsOf(ownerId) {
  return [...rooms.values()].filter((r) => r.ownerId === ownerId && r.status !== "ended").length;
}

export function createRoom({ name, ownerId, ownerName, classId = null, hostPlays, mode, seconds, maxRounds, teams, extraWords }) {
  let code;
  do code = code6();
  while (rooms.has(code));
  const equipos = mode === "equipos";
  const room = {
    id: crypto.randomUUID(),
    code,
    name: clean(name, 60) || "Palabra relámpago",
    ownerId,
    ownerName: clean(ownerName, 40),
    classId,
    hostPlays: !!hostPlays,
    mode: equipos ? "equipos" : "individual",
    seconds: clamp(seconds, LIMITS.minSeconds, LIMITS.maxSeconds, 20),
    maxRounds: clamp(maxRounds, LIMITS.minRounds, LIMITS.maxRounds, 30),
    // Palabras extra: solo las pone el docente al crear la sala (ver routes.js).
    extra: new Set((Array.isArray(extraWords) ? extraWords : []).map(normalizeWord).filter(safeWord).slice(0, LIMITS.maxExtraWords)),
    status: "lobby", // lobby | turn | result | ended
    players: new Map(), // id -> { id, name, userId, team }
    entities: [], // participantes que juegan: personas (individual) o equipos
    used: new Set(),
    usedList: [],
    turn: null, // { n, entityIdx, playerId, fragment, deadline }
    typing: "",
    round: 0,
    lastResult: null,
    resultUntil: null,
    createdAt: Date.now(),
  };
  if (equipos) {
    const n = clamp(teams, LIMITS.minTeams, LIMITS.maxTeams, 2);
    room.entities = Array.from({ length: n }, (_, i) => newEntity(`t${i}`, TEAM_NAMES[i], i));
  }
  rooms.set(code, room);
  return room;
}
const newEntity = (id, name, i) => ({ id, name, color: COLORS[i % COLORS.length], lives: LIVES, score: 0, words: 0, memberIds: [], cursor: 0 });
export const getRoom = (code) => rooms.get(String(code || "").trim()) || null;

// ------------------------------ jugadores ------------------------------
export function addPlayer(room, { id, name, userId = null }) {
  const existing = id && room.players.get(id);
  if (existing) return { player: existing };
  if (room.status !== "lobby") return { error: "La partida ya empezó. Pide a quien la creó que abra otra." };
  if (room.players.size >= LIMITS.maxPlayers) return { error: "La sala está llena." };
  const nombre = clean(name, 30);
  if (!nombre) return { error: "Escribe tu nombre para entrar." };
  const lower = nombre.toLowerCase();
  if ([...room.players.values()].some((p) => p.name.toLowerCase() === lower)) return { error: "Ya hay alguien con ese nombre. Agrega tu apellido o inicial." };
  const player = { id: crypto.randomUUID(), name: nombre, userId, team: null };
  room.players.set(player.id, player);
  return { player };
}
export function removePlayer(room, playerId) {
  if (room.status !== "lobby") return { error: "La partida ya empezó." };
  room.players.delete(playerId);
  return { ok: true };
}
export function setTeam(room, playerId, teamId) {
  const p = room.players.get(playerId);
  if (!p) return { error: "No estás en esta sala." };
  if (room.status !== "lobby") return { error: "La partida ya empezó." };
  if (room.mode !== "equipos") return { error: "Esta partida es individual." };
  if (!room.entities.some((e) => e.id === teamId)) return { error: "Ese equipo no existe." };
  p.team = teamId;
  return { ok: true };
}

// ------------------------------ flujo ------------------------------
const alive = (room) => room.entities.filter((e) => e.lives > 0);

export function start(room) {
  if (room.status !== "lobby") return { error: "La partida ya empezó." };
  const players = [...room.players.values()];
  if (room.mode === "individual") {
    room.entities = players.map((p, i) => {
      const e = newEntity(p.id, p.name, i);
      e.memberIds = [p.id];
      p.team = p.id;
      return e;
    });
  } else {
    // Quien no eligió equipo entra al que tenga menos integrantes.
    for (const p of players) {
      if (p.team) continue;
      const menor = room.entities.reduce((a, b) => (members(room, a.id) <= members(room, b.id) ? a : b));
      p.team = menor.id;
    }
    for (const e of room.entities) e.memberIds = players.filter((p) => p.team === e.id).map((p) => p.id);
    // Equipos sin integrantes quedan fuera.
    room.entities = room.entities.filter((e) => e.memberIds.length > 0);
  }
  if (room.entities.length < 2) {
    return { error: room.mode === "equipos" ? "Se necesitan al menos 2 equipos con jugadores." : "Se necesitan al menos 2 jugadores." };
  }
  room.round = 1;
  beginTurn(room, 0);
  return { ok: true };
}
const members = (room, teamId) => [...room.players.values()].filter((p) => p.team === teamId).length;

function chooseFragment(room, avoid) {
  const choices = candidateFragments(room.used, room.extra).filter((f) => f !== avoid);
  return choices[crypto.randomInt(0, Math.max(1, choices.length))] || "sa";
}

function beginTurn(room, entityIdx) {
  const e = room.entities[entityIdx];
  const playerId = e.memberIds[e.cursor % e.memberIds.length];
  room.status = "turn";
  room.typing = "";
  room.lastResult = null;
  room.resultUntil = null;
  room.turn = {
    n: (room.turn?.n || 0) + 1,
    entityIdx,
    playerId,
    fragment: chooseFragment(room, room.turn?.fragment),
    deadline: Date.now() + room.seconds * 1000,
  };
}

function finishTurn(room, { ok, word = "", points = 0, reason = "" }) {
  const t = room.turn;
  const e = room.entities[t.entityIdx];
  const p = room.players.get(t.playerId);
  if (ok) {
    e.score += points;
    e.words += 1;
    const w = normalizeWord(word);
    room.used.add(w);
    room.usedList.push({ word: w, by: p?.name || "", team: e.name, color: e.color });
  } else {
    e.lives = Math.max(0, e.lives - 1);
  }
  e.cursor += 1; // el siguiente turno de este equipo lo responde otro integrante
  room.status = "result";
  room.typing = "";
  room.lastResult = { entityId: e.id, entityName: e.name, playerName: p?.name || "", ok, word: ok ? word : "", points, reason, eliminated: !ok && e.lives === 0 };
  room.resultUntil = Date.now() + RESULT_MS;
}

function advance(room) {
  const sobreviven = alive(room);
  const siguienteRonda = room.round + 1;
  if (sobreviven.length < 2 || siguienteRonda > room.maxRounds) {
    room.status = "ended";
    room.turn = null;
    return;
  }
  const n = room.entities.length;
  const from = room.turn.entityIdx;
  const next = Array.from({ length: n }, (_, i) => (from + i + 1) % n).find((i) => room.entities[i].lives > 0);
  room.round = siguienteRonda;
  beginTurn(room, next);
}

export function end(room) {
  if (room.status === "ended") return { error: "La partida ya terminó." };
  room.status = "ended";
  room.turn = null;
  return { ok: true };
}

export function submit(room, playerId, word) {
  if (room.status !== "turn") return { error: "Espera tu turno." };
  if (room.turn.playerId !== playerId) return { error: "No es tu turno." };
  const now = Date.now();
  if (now > room.turn.deadline + GRACE_MS) return { error: "Se acabó el tiempo." };
  const w = String(word ?? "").slice(0, 40);
  const motivo = checkWord(w, room.turn.fragment, room.used, room.extra);
  if (motivo) return { error: motivo };
  const left = Math.max(0, Math.ceil((room.turn.deadline - now) / 1000));
  finishTurn(room, { ok: true, word: w.trim(), points: 10 + left });
  return { ok: true };
}
export function skip(room, playerId) {
  if (room.status !== "turn") return { error: "Espera tu turno." };
  if (room.turn.playerId !== playerId) return { error: "No es tu turno." };
  finishTurn(room, { ok: false, reason: "skip" });
  return { ok: true };
}
export function setTyping(room, playerId, text) {
  if (room.status !== "turn" || room.turn.playerId !== playerId) return false;
  room.typing = String(text ?? "").slice(0, 35);
  return true;
}

// Reloj (cada segundo): vence el turno o pasa del resultado al siguiente turno.
export function tick(room) {
  const now = Date.now();
  if (room.status === "turn" && now >= room.turn.deadline) finishTurn(room, { ok: false, reason: "time" });
  else if (room.status === "result" && now >= room.resultUntil) advance(room);
}

// ------------------------------ vista pública ------------------------------
const ranking = (room) =>
  [...room.entities].sort((a, b) => b.score - a.score || b.lives - a.lives).map((e, i) => ({ ...e, rank: i + 1 }));

// Lo que ve cada quien. No hay nada secreto (el diccionario nunca se manda).
export function publicState(room, playerId = null, isHost = false) {
  const entities = room.entities.map((e) => ({ id: e.id, name: e.name, color: e.color, lives: e.lives, score: e.score, words: e.words, members: e.memberIds.map((id) => room.players.get(id)?.name).filter(Boolean) }));
  const base = {
    code: room.code,
    name: room.name,
    status: room.status,
    mode: room.mode,
    seconds: room.seconds,
    maxRounds: room.maxRounds,
    round: room.round,
    hostName: room.ownerName,
    hostPlays: room.hostPlays,
    isHost,
    classId: room.classId ? true : false,
    now: Date.now(),
    extraCount: room.extra.size,
    entities,
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team })),
    teams: room.mode === "equipos" && room.status === "lobby" ? room.entities.map((e) => ({ id: e.id, name: e.name, color: e.color })) : undefined,
    used: room.usedList.slice(-200).reverse(), // las más recientes primero
    usedCount: room.usedList.length,
    lastResult: room.lastResult,
  };
  if (room.turn) {
    const e = room.entities[room.turn.entityIdx];
    base.turn = {
      n: room.turn.n,
      entityId: e.id,
      playerId: room.turn.playerId,
      playerName: room.players.get(room.turn.playerId)?.name || "",
      fragment: room.turn.fragment,
      deadline: room.turn.deadline,
      typing: room.typing,
    };
  }
  if (room.status === "ended") base.ranking = ranking(room).map(({ id, name, color, score, lives, words, rank }) => ({ id, name, color, score, lives, words, rank }));
  if (playerId) {
    const p = room.players.get(playerId);
    if (p) base.me = { id: p.id, name: p.name, team: p.team };
  }
  return base;
}

export function purgeOldRooms(limit) {
  for (const [code, r] of rooms) if (r.createdAt < limit) rooms.delete(code);
}
