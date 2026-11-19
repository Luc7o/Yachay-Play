import express from "express";

import "./env.js"; // carga backend/.env antes que cualquier otro módulo
import cors from "cors";
import http from "http";
import crypto from "node:crypto";
import { Server } from "socket.io";
import { nanoid, customAlphabet } from "nanoid";
import db from "./db.js";
import { ensureQuestions, reloadQuestions, poolFor, questionsRouter } from "./questionBank.js";
import { statsRouter } from "./stats.js";
import { profileRouter } from "./profile.js";
import { GOAL_STEP, SAFE_INDEXES, ringIndexForStep } from "./board.js";
import { authRouter, authOptional, requireTeacher } from "./auth.js";
import { userFromToken, getAuthSecret } from "./authCore.js";
import { seedDemoUsers } from "./seed.js";
import { crosswordRouter } from "./crossword/routes.js";
import { restoreCrosswordRooms } from "./crossword/persist.js";
import { assistantRouter } from "./assistant.js";
import { attachCrosswordSocket, crosswordTick } from "./crossword/sockets.js";
import { purgeOldRooms } from "./crossword/engine.js";
import { slidesRouter } from "./slides/routes.js";
import { attachSlidesSocket, startSlidesCleanup } from "./slides/sockets.js";
import { startSlidesPersistence } from "./slides/persist.js";
import { quickRouter } from "./quick/routes.js";
import { attachQuizSocket, quizTick } from "./quick/sockets.js";
import { purgeOldRooms as purgeOldQuizzes, rooms as quizRooms } from "./quick/engine.js";
import { rooms as crosswordRooms } from "./crossword/engine.js";
import { rooms as slidesRooms } from "./slides/engine.js";
import { classesRouter, claseDelDocente } from "./classes/routes.js";
import { registrarFuente } from "./classes/live.js";

// Guarda en la base de datos SIN frenar el juego en tiempo real: si falla, solo se avisa en consola.
const bg = (promesa) => promesa.catch((e) => console.error("Error de base de datos:", e.message));
// Guarda en la base de datos que la partida terminó, quién ganó y por qué.
// Gana quien llegó a la meta; si se acabó el tiempo o el docente cerró, gana el equipo
// con más puntos (si hay empate en el primer lugar, no hay ganador).
function persistFinish(game, reason) {
  let winner = game.winner || null;
  if (!winner) {
    const ranking = game.activeTeams.map((c) => ({ c, score: game.teams[c].score })).sort((a, b) => b.score - a.score);
    if (ranking.length && ranking[0].score > 0 && (ranking.length < 2 || ranking[0].score > ranking[1].score)) {
      winner = ranking[0].c;
    }
  }
  bg(
    db
      .prepare("UPDATE games SET phase = 'finished', winner_team = ?, end_reason = ?, finished_at = now() WHERE id = ?")
      .run(winner, reason, game.id)
  );
}

process.on("unhandledRejection", (e) => console.error("Promesa sin manejar:", e));

const app = express();
// Cuántos proxies hay delante (Render/Railway/Fly: 1; Cloudflare + Render: 2; ninguno: 0).
// Si el número no coincide, req.ip sale mal: o se puede falsificar con X-Forwarded-For
// (y saltarse los límites por IP) o todos los usuarios comparten la IP del proxy.
const PROXIES = Number.parseInt(process.env.TRUST_PROXY ?? "1", 10);
app.set("trust proxy", Number.isInteger(PROXIES) && PROXIES >= 0 ? PROXIES : 1);
const ORIGENES = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
// Avisos de configuración insegura o incompleta (solo en producción).
if (process.env.NODE_ENV === "production") {
  if (!process.env.AUTH_SECRET) console.warn("[SEGURIDAD] Falta AUTH_SECRET: la clave de sesiones y del 2FA se guarda en la misma base de datos. Define AUTH_SECRET en el hosting.");
  if (!ORIGENES.length) console.warn("[SEGURIDAD] Falta CORS_ORIGIN: cualquier sitio web podría llamar a la API. Pon la URL de tu frontend.");
  if (!process.env.RESEND_API_KEY) console.warn("[CORREO] Falta RESEND_API_KEY: no se enviarán los correos de recuperación ni de verificación.");
  if (!process.env.GOOGLE_CLIENT_ID) console.warn("[GOOGLE] Falta GOOGLE_CLIENT_ID: el botón «Continuar con Google» no funcionará.");
}
app.use(cors(ORIGENES.length ? { origin: ORIGENES } : undefined));
// Cabeceras de seguridad básicas (la API solo devuelve JSON).
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
});
app.use(express.json({ limit: "1mb" }));
// JSON malformado o demasiado grande: responder en JSON (antes salía la página HTML de error de Express).
app.use((err, _req, res, next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Datos inválidos." });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Los datos son demasiado grandes." });
  next(err);
});
app.use(authOptional); // deja el usuario de la sesión (si hay) en req.user
app.use("/api/auth", authRouter);
app.use("/api/classes", classesRouter); // clases (curso + sección) del docente y sus estudiantes
app.use("/api/crossword-games", crosswordRouter); // juego nuevo: Crucigrama Relámpago
app.use("/api/quick-quizzes", quickRouter); // Evaluación rápida (preguntas en vivo)
app.use("/api/slides", slidesRouter); // Presentaciones en vivo (docente ve las de sus estudiantes)
app.use("/api/assistant", assistantRouter); // asistente IA, solo para docentes
app.use("/api/profile", profileRouter); // perfil, ranking y logros
app.use("/api/stats", statsRouter); // estadísticas del docente / historial del estudiante
app.use("/api/my-questions", questionsRouter); // banco de preguntas propias del docente

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGENES.length ? ORIGENES : "*" } });

const codeGen = customAlphabet("0123456789", 6);
const TEAM_COLORS = ["rojo", "verde", "amarillo", "azul"];

// ============================================================================
// EL TURNO ES UNA MÁQUINA DE ESTADOS AUTOMÁTICA
// ============================================================================
// El docente ya no toca nada. El servidor lleva un reloj (un "tick" por
// segundo) y va cambiando solo de una fase a la siguiente:
//
//   "roll"     -> el equipo en turno debe lanzar el dado desde su celular.
//                 Si nadie lanza en ROLL_SECONDS, el servidor lanza solo.
//   "rolling"  -> el dado ya salió; pausa corta para la animación.
//   "question" -> se muestra la pregunta. Si nadie responde, cuenta como fallo.
//   "result"   -> se muestra qué pasó y, al terminar, pasa solo al siguiente turno.
//
// ============================================================================
const ROLLING_SECONDS = 2; // duración de la animación del dado (fija)
const RESULT_SECONDS = 6; // cuánto se muestra el resultado antes del siguiente turno

// Valores POR DEFECTO. El docente los elige al crear la partida y quedan
// guardados dentro de cada partida (game.rollSeconds / game.answerTimeLimit).
const DEFAULT_ROLL_SECONDS = 15;
const DEFAULT_ANSWER_SECONDS = 20;
const DEFAULT_MINUTES = 30;

// --- Banco de preguntas: oficiales + las propias de cada docente (ver questionBank.js) ---
await ensureQuestions();
await reloadQuestions();

// --- Estado en memoria de las partidas activas (code -> estado completo) ---
const games = new Map();

// ============================================================================
// RECUPERAR PARTIDAS AL REINICIAR EL SERVIDOR
// ============================================================================
// El Map `games` vive en memoria, así que si el servidor se reinicia se perdían
// TODAS las partidas: el docente y los alumnos se quedaban con un código que ya
// no existía y la pantalla nunca cargaba. Como los datos sí están en SQLite,
// al arrancar reconstruimos cada partida no finalizada y la dejamos en la sala
// de espera, con sus alumnos ya registrados.
// ============================================================================
async function restoreGamesFromDb() {
  // Las partidas abandonadas hace más de 12 h se cierran (si no, se acumulaban para siempre).
  await db
    .prepare("UPDATE games SET phase = 'finished', end_reason = 'expired', finished_at = now() WHERE phase <> 'finished' AND created_at < now() - interval '12 hours'")
    .run();
  const filas = await db.prepare("SELECT * FROM games WHERE phase <> 'finished'").all();
  for (const g of filas) {
    const equipos = await db.prepare("SELECT * FROM teams WHERE game_id = ?").all(g.id);
    const jugadores = await db.prepare("SELECT * FROM players WHERE game_id = ?").all(g.id);
    const activeTeams = String(g.active_teams || "rojo,verde,amarillo,azul")
      .split(",")
      .filter((c) => TEAM_COLORS.includes(c));
    if (activeTeams.length < 2) continue;

    const teams = {};
    equipos.forEach((t) => {
      teams[t.color] = { id: t.id, slots: t.slots, score: t.score, correct: t.correct, incorrect: t.incorrect };
    });
    if (TEAM_COLORS.some((c) => !teams[c])) continue; // partida incompleta, la ignoramos

    const positions = {};
    jugadores.forEach((p) => {
      positions[p.id] = -1; // las fichas vuelven a casa: se reinicia la ronda
    });

    games.set(g.code, {
      id: g.id,
      code: g.code,
      ownerId: g.owner_id || null,
      classId: g.class_id || null,
      name: g.name,
      phase: "lobby",
      turnPhase: "roll",
      phaseSecondsLeft: g.roll_seconds,
      activeTeams,
      currentTeamIndex: TEAM_COLORS.indexOf(activeTeams[0]),
      turnCounter: 1,
      durationMinutes: g.minutes,
      timerSeconds: g.minutes * 60,
      timerRunning: false,
      rollSeconds: g.roll_seconds,
      teams,
      players: jugadores.map((p) => ({ id: p.id, name: p.name, team: p.team })),
      positions,
      history: [],
      currentQuestion: null,
      awaitingAnswer: false,
      lastDice: null,
      diceRollId: 0,
      rolledBy: null,
      answerTimeLimit: g.answer_seconds,
      lastResult: null,
      winner: null,
      round: 1,
      restored: true,
      createdAt: Date.now(),
    });
  }
  if (games.size) console.log(`Partidas recuperadas de la base de datos: ${[...games.keys()].join(", ")}`);
}
await restoreGamesFromDb();

// Cuentas establecidas: un docente y un estudiante de prueba
await restoreCrosswordRooms();
await startSlidesPersistence(); // crea su tabla sola, recupera salas y guarda cada 4 s
startSlidesCleanup();

const cuentasNuevas = await seedDemoUsers();
if (cuentasNuevas.length) console.log(`Cuentas de prueba creadas: ${cuentasNuevas.join(", ")}`);

// Llave privada de cada jugador de Ludo. Los ids de los jugadores son públicos
// (salen en el estado de la partida), así que para actuar por un jugador hay
// que presentar esta llave, que solo recibe quien se unió con /join.
// Es un HMAC del id: no hay que guardarla y sigue sirviendo tras reiniciar el servidor.
function llaveJugador(playerId) {
  return crypto.createHmac("sha256", getAuthSecret()).update(`ludo-player:${playerId}`).digest("base64url");
}
function llaveValida(playerId, llave) {
  if (typeof playerId !== "string" || typeof llave !== "string") return false;
  const a = Buffer.from(llave);
  const b = Buffer.from(llaveJugador(playerId));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function publicState(game) {
  const { currentQuestion, ownerId, classId, createdAt, ...rest } = game; // no exponemos el id del docente ni de la clase
  return {
    ...rest,
    currentTeam: TEAM_COLORS[game.currentTeamIndex],
    currentQuestion: currentQuestion
      ? {
          id: currentQuestion.id,
          topic: currentQuestion.topic,
          level: currentQuestion.level,
          question: currentQuestion.question,
          options: currentQuestion.options,
        }
      : null,
  };
}

// Actividades abiertas por clase (las muestra /api/classes). Una línea por juego.
registrarFuente(() =>
  [...games.values()]
    .filter((g) => g.classId && g.phase !== "finished")
    .map((g) => ({ classId: g.classId, kind: "ludo", code: g.code, name: g.name, status: g.phase, players: g.players.length }))
);
registrarFuente(() =>
  [...crosswordRooms.values()]
    .filter((r) => r.classId && r.status !== "ended")
    .map((r) => ({ classId: r.classId, kind: "crucigrama", code: r.code, name: r.name, status: r.status, players: r.players.size }))
);
registrarFuente(() =>
  [...quizRooms.values()]
    .filter((r) => r.classId && r.status !== "ended")
    .map((r) => ({ classId: r.classId, kind: "evaluacion", code: r.code, name: r.name, status: r.status, players: r.players.size }))
);
registrarFuente(() =>
  [...slidesRooms.values()]
    .filter((r) => r.classId && r.status !== "closed" && !r.deleted)
    .map((r) => ({ classId: r.classId, kind: "estudio", code: r.code, name: r.name, status: r.status, players: r.students.size }))
);

function broadcast(code) {
  const game = games.get(code);
  if (game) io.to(code).emit("state", publicState(game));
}

// ---------------------- REST API ----------------------

// Solo un docente con sesión iniciada puede crear partidas.
app.post("/api/games", requireTeacher, async (req, res) => {
  try {
  const { name, counts, minutes, answerSeconds, rollSeconds, classId } = req.body;
  if (!name || !counts) return res.status(400).json({ error: "name y counts son requeridos" });
  // classId opcional: la partida queda en el historial de esa clase (solo si es del docente).
  const clase = classId ? await claseDelDocente(classId, req.user.id) : null;
  if (classId && !clase) return res.status(404).json({ error: "No encontramos esa clase." });

  // Un color con 0 cupos simplemente NO JUEGA. Hacen falta al menos 2 colores.
  const activeTeams = TEAM_COLORS.filter((c) => Number(counts[c]) > 0);
  if (activeTeams.length < 2) return res.status(400).json({ error: "Deben jugar al menos 2 colores" });

  const durationMinutes = Math.min(180, Math.max(1, Number(minutes) || DEFAULT_MINUTES));
  const answerLimit = Math.min(120, Math.max(5, Number(answerSeconds) || DEFAULT_ANSWER_SECONDS));
  const rollLimit = Math.min(60, Math.max(3, Number(rollSeconds) || DEFAULT_ROLL_SECONDS));

  const id = nanoid();
  let code;
  for (let intento = 0; ; intento++) {
    code = codeGen();
    if (games.has(code)) continue;
    try {
      await db
        .prepare(
          "INSERT INTO games (id, code, name, minutes, answer_seconds, roll_seconds, active_teams, owner_id, class_id) VALUES (?,?,?,?,?,?,?,?,?)"
        )
        .run(id, code, String(name).slice(0, 80), durationMinutes, answerLimit, rollLimit, activeTeams.join(","), req.user.id, clase?.id || null);
      break;
    } catch (e) {
      // 23505 = código repetido (choca con una partida vieja): probamos otro
      if (e.code !== "23505" || intento >= 8) throw e;
    }
  }

  const teams = {};
  for (const color of TEAM_COLORS) {
    const slots = Math.min(4, Math.max(0, Number(counts[color]) || 0));
    const teamId = nanoid();
    await db.prepare("INSERT INTO teams (id, game_id, color, slots) VALUES (?,?,?,?)").run(teamId, id, color, slots);
    teams[color] = { id: teamId, slots, score: 0, correct: 0, incorrect: 0 };
  }

  games.set(code, {
    id,
    code,
    ownerId: req.user.id, // docente dueño de la partida
    classId: clase?.id || null, // clase a la que pertenece (o null)
    createdAt: Date.now(),
    name: String(name).slice(0, 80),
    phase: "lobby", // lobby | playing | finished
    turnPhase: "roll", // roll | rolling | question | result
    phaseSecondsLeft: rollLimit,
    activeTeams, // colores que SÍ juegan esta partida
    currentTeamIndex: TEAM_COLORS.indexOf(activeTeams[0]),
    turnCounter: 1,
    durationMinutes,
    timerSeconds: durationMinutes * 60,
    timerRunning: false,
    rollSeconds: rollLimit,
    teams,
    players: [],
    positions: {}, // playerId -> paso del recorrido (-1 = en casa, 56 = meta)
    history: [],
    currentQuestion: null,
    awaitingAnswer: false,
    lastDice: null,
    diceRollId: 0, // cambia en cada lanzamiento: dispara la animación en el cliente
    rolledBy: null, // nombre del alumno que lanzó (o null si lo lanzó el servidor)
    answerTimeLimit: answerLimit,
    lastResult: null,
    winner: null,
    round: 1,
  });

  res.json({ code, gameId: id });
  } catch (e) {
    console.error("Error creando la partida:", e.message);
    res.status(500).json({ error: "No se pudo crear la partida. Intenta otra vez." });
  }
});

app.get("/api/games/:code", (req, res) => {
  const game = games.get(req.params.code);
  if (!game) return res.status(404).json({ error: "Partida no encontrada" });
  res.json(publicState(game));
});

app.post("/api/games/:code/join", async (req, res) => {
  const game = games.get(req.params.code);
  if (!game) return res.status(404).json({ error: "Partida no encontrada" });

  const team = req.body?.team;
  const name = String(req.body?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
  if (!name || !TEAM_COLORS.includes(team)) return res.status(400).json({ error: "Datos inválidos" });
  if (!game.activeTeams.includes(team)) return res.status(400).json({ error: "Ese color no juega en esta partida" });
  if (game.phase !== "lobby") return res.status(400).json({ error: "La partida ya inició" });

  const currentInTeam = game.players.filter((p) => p.team === team).length;
  if (currentInTeam >= game.teams[team].slots) {
    return res.status(400).json({ error: "El equipo ya está completo" });
  }

  // Una cuenta = un lugar por partida: si ya se unió (p. ej. desde otro celular),
  // recupera su mismo jugador en vez de crear otro (evita inflar el ranking).
  if (req.user?.id) {
    const previo = await db.prepare("SELECT id FROM players WHERE game_id = ? AND user_id = ? LIMIT 1").get(game.id, req.user.id);
    const enMemoria = previo && game.players.find((p) => p.id === previo.id);
    if (enMemoria) return res.json({ playerId: enMemoria.id, playerKey: llaveJugador(enMemoria.id), code: game.code, team: enMemoria.team });
  }

  const playerId = nanoid();
  try {
    await db.prepare("INSERT INTO players (id, game_id, team, name, user_id) VALUES (?,?,?,?,?)").run(playerId, game.id, team, name, req.user?.id || null);
  } catch (e) {
    console.error("Error al registrar al jugador:", e.message);
    return res.status(500).json({ error: "No se pudo unir a la partida. Intenta otra vez." });
  }
  // Revisamos de nuevo el cupo: mientras se guardaba, otro alumno pudo ocupar el lugar.
  if (game.players.filter((p) => p.team === team).length >= game.teams[team].slots) {
    bg(db.prepare("DELETE FROM players WHERE id = ?").run(playerId));
    return res.status(400).json({ error: "El equipo ya está completo" });
  }
  game.players.push({ id: playerId, name, team });
  game.positions[playerId] = -1;

  broadcast(game.code);
  res.json({ playerId, playerKey: llaveJugador(playerId), code: game.code });
});

// Preguntas disponibles (sin la respuesta correcta): oficiales + las del docente si hay sesión.
app.get("/api/questions", (req, res) => {
  const dueno = req.user?.role === "docente" ? req.user.id : null;
  res.json(poolFor(dueno).map(({ answerIndex, ownerId, active, ...q }) => q));
});

// ============================================================================
// TRANSICIONES DE FASE (las llama el reloj o una acción del alumno)
// ============================================================================

function setPhase(game, turnPhase, seconds) {
  game.turnPhase = turnPhase;
  game.phaseSecondsLeft = seconds;
  game.awaitingAnswer = turnPhase === "question";
}

/**
 * Equipos que pueden jugar el turno: los que el docente activó Y que además
 * tienen al menos un alumno conectado. Si ninguno tiene alumnos todavía,
 * devolvemos todos los activos para que la rueda no se detenga.
 */
function eligibleTeams(game) {
  const conAlumnos = game.activeTeams.filter((c) => game.players.some((p) => p.team === c));
  return conAlumnos.length ? conAlumnos : game.activeTeams;
}

/** Lanza el dado. lanzadoPor = nombre del alumno, o null si lo lanzó el servidor. */
function rollDice(game, code, lanzadoPor) {
  if (game.phase !== "playing" || game.turnPhase !== "roll") return;
  game.lastDice = Math.floor(Math.random() * 6) + 1;
  game.diceRollId++;
  game.rolledBy = lanzadoPor;
  setPhase(game, "rolling", ROLLING_SECONDS);
  broadcast(code);
}

// Orden barajado de preguntas por partida. Antes salían siempre en el mismo orden
// (ORDER BY id), así que quien ya había jugado se sabía las respuestas.
// Va en un WeakMap, fuera de `game`, para que no viaje en publicState.
const ordenPreguntas = new WeakMap(); // game -> { ids: [...], i }
function siguientePregunta(game) {
  const pool = poolFor(game.ownerId);
  if (!pool.length) return null;
  let o = ordenPreguntas.get(game);
  if (!o || o.i >= o.ids.length) {
    const ids = pool.map((q) => q.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    o = { ids, i: 0 };
    ordenPreguntas.set(game, o);
  }
  // Si el docente borró una pregunta a mitad de partida, se salta.
  while (o.i < o.ids.length) {
    const q = pool.find((x) => x.id === o.ids[o.i++]);
    if (q) return q;
  }
  ordenPreguntas.delete(game);
  return siguientePregunta(game);
}

/** Muestra la pregunta del turno. */
function startQuestion(game, code) {
  game.currentQuestion = siguientePregunta(game);
  game.lastResult = null;
  setPhase(game, "question", game.answerTimeLimit);
  broadcast(code);
}

/** Pasa al siguiente equipo QUE TENGA ALUMNOS y reabre la fase de lanzamiento. */
function nextTurn(game, code) {
  const elegibles = eligibleTeams(game);
  // Avanzamos de color en color hasta encontrar uno que pueda jugar.
  for (let i = 1; i <= TEAM_COLORS.length; i++) {
    const idx = (game.currentTeamIndex + i) % TEAM_COLORS.length;
    if (elegibles.includes(TEAM_COLORS[idx])) {
      game.currentTeamIndex = idx;
      break;
    }
  }

  game.turnCounter++;
  game.currentQuestion = null;
  game.lastDice = null;
  game.rolledBy = null;
  game.lastResult = null;
  setPhase(game, "roll", game.rollSeconds);
  broadcast(code);
}

// ---------------------- Socket.IO: tiempo real ----------------------

// El navegador manda su token al conectarse; si es válido sabemos quién es.
io.use(async (socket, next) => {
  try {
    socket.data.user = await userFromToken(socket.handshake.auth?.token);
  } catch (e) {
    console.error("Error leyendo la sesión del socket:", e.message);
    socket.data.user = null;
  }
  next();
});

// Devuelve la partida solo si quien pregunta es el docente que la creó.
function teacherGame(socket, code) {
  const game = games.get(code);
  if (!game) return null;
  const u = socket.data.user;
  if (!u || u.role !== "docente") {
    socket.emit("error-message", "Inicia sesión como docente para controlar la partida.");
    return null;
  }
  // Sin dueño (p. ej. el docente borró su cuenta): nadie la controla; antes podía cualquier docente.
  if (game.ownerId !== u.id) {
    socket.emit("error-message", game.ownerId ? "Esta partida pertenece a otro docente." : "Esta partida ya no tiene docente a cargo.");
    return null;
  }
  return game;
}

io.on("connection", (socket) => {
  // Un evento sin datos (p. ej. emit("join-room")) haría fallar la desestructuración
  // `({ code }) =>` y tumbaría TODO el servidor. Se rechaza antes de llegar al handler.
  socket.use(([evento, payload], next) => {
    const conDatos = typeof evento === "string" && /^(engineer:|player:|team:)|^join-room$/.test(evento);
    if (conDatos && (payload === null || typeof payload !== "object")) return next(new Error("Datos inválidos"));
    next();
  });
});

// Crucigrama Relámpago: escucha sus propios eventos "cw:*" en cada conexión
// (aparte de todo el bloque de Ludo de aquí abajo, para no mezclarlos).
io.on("connection", (socket) => attachCrosswordSocket(io, socket));
io.on("connection", (socket) => attachQuizSocket(io, socket)); // Evaluación rápida (eventos "qz:*")
io.on("connection", (socket) => attachSlidesSocket(io, socket)); // Presentaciones en vivo (eventos "ss:*")

io.on("connection", (socket) => {
  socket.on("join-room", ({ code }) => {
    const game = games.get(code);
    if (!game) return socket.emit("error-message", "Partida no encontrada");
    socket.join(code);
    socket.emit("state", publicState(game));
  });

  socket.on("engineer:start-game", ({ code }) => {
    const game = teacherGame(socket, code);
    if (!game) return;
    // Solo desde la sala de espera: si no, se reiniciaría el turno a mitad de partida
    // o se reabriría una partida ya terminada.
    if (game.phase !== "lobby") return;
    game.phase = "playing";
    // El primer turno lo toma el primer equipo elegible.
    game.currentTeamIndex = TEAM_COLORS.indexOf(eligibleTeams(game)[0]);
    setPhase(game, "roll", game.rollSeconds);
    bg(db.prepare("UPDATE games SET phase = ? WHERE id = ?").run("playing", game.id));
    broadcast(code);
  });

  socket.on("engineer:toggle-timer", ({ code }) => {
    const game = teacherGame(socket, code);
    if (!game) return;
    game.timerRunning = !game.timerRunning;
    broadcast(code);
  });

  // ------------------------------------------------------------------
  // EL DOCENTE CONTROLA EL TIEMPO DE LA PARTIDA
  // ------------------------------------------------------------------
  // seconds puede ser positivo (agregar tiempo) o negativo (quitar tiempo)
  socket.on("engineer:add-time", ({ code, seconds }) => {
    const game = teacherGame(socket, code);
    if (!game) return;
    const delta = Number.isFinite(Number(seconds)) ? Number(seconds) : 0;
    game.timerSeconds = Math.max(0, Math.min(180 * 60, game.timerSeconds + delta));
    broadcast(code);
  });

  // Volver a poner el reloj en la duración elegida al crear la partida
  socket.on("engineer:reset-timer", ({ code, minutes }) => {
    const game = teacherGame(socket, code);
    if (!game) return;
    if (Number.isFinite(Number(minutes)) && Number(minutes) > 0) game.durationMinutes = Math.min(180, Math.max(1, Number(minutes)));
    game.timerSeconds = game.durationMinutes * 60;
    game.timerRunning = false;
    broadcast(code);
  });

  // Cambiar en caliente los segundos para responder / para lanzar el dado
  socket.on("engineer:set-limits", ({ code, answerSeconds, rollSeconds }) => {
    const game = teacherGame(socket, code);
    if (!game) return;
    // Number.isFinite: con "abc" quedaba NaN y las fases avanzaban cada segundo.
    if (Number.isFinite(Number(answerSeconds)) && Number(answerSeconds) > 0) game.answerTimeLimit = Math.min(120, Math.max(5, Number(answerSeconds)));
    if (Number.isFinite(Number(rollSeconds)) && Number(rollSeconds) > 0) game.rollSeconds = Math.min(60, Math.max(3, Number(rollSeconds)));
    broadcast(code);
  });

  // ------------------------------------------------------------------
  // EL ALUMNO LANZA EL DADO desde su celular
  // ------------------------------------------------------------------
  socket.on("player:roll-dice", ({ code, playerId, playerKey }) => {
    const game = games.get(code);
    if (!game || game.phase !== "playing" || game.turnPhase !== "roll") return;
    if (!llaveValida(playerId, playerKey)) return socket.emit("error-message", "Vuelve a unirte a la partida para poder jugar.");

    const player = game.players.find((p) => p.id === playerId);
    if (!player || player.team !== TEAM_COLORS[game.currentTeamIndex]) return;

    rollDice(game, code, player.name);
  });

  // Cualquier estudiante del equipo en turno puede responder; vale la primera respuesta
  socket.on("team:answer", ({ code, playerId, playerKey, optionIndex }) => {
    const game = games.get(code);
    if (!game || game.phase !== "playing" || game.turnPhase !== "question" || !game.currentQuestion) return;
    if (!llaveValida(playerId, playerKey)) return socket.emit("error-message", "Vuelve a unirte a la partida para poder jugar.");
    if (!Number.isInteger(optionIndex)) return;

    const currentTeam = TEAM_COLORS[game.currentTeamIndex];
    const player = game.players.find((p) => p.id === playerId);
    if (!player || player.team !== currentTeam) return;

    resolveAnswer(game, code, currentTeam, playerId, optionIndex);
  });

  // Válvula de escape para el docente: adelantar el turno si algo se traba
  socket.on("engineer:skip-turn", ({ code }) => {
    const game = teacherGame(socket, code);
    if (!game || game.phase !== "playing") return;
    nextTurn(game, code);
  });

  socket.on("engineer:end-game", ({ code }) => {
    const game = teacherGame(socket, code);
    if (!game || game.phase === "finished") return;
    game.phase = "finished";
    game.timerRunning = false;
    game.awaitingAnswer = false;
    game.currentQuestion = null;
    persistFinish(game, "teacher");
    broadcast(code);
  });

  // ADMIN: volver a crear la partida SIN cambiar el código.
  socket.on("engineer:reset-game", ({ code }) => {
    const game = teacherGame(socket, code);
    if (!game) return;

    game.phase = "lobby";
    game.currentTeamIndex = 0;
    game.turnCounter = 1;
    game.timerSeconds = game.durationMinutes * 60;
    game.timerRunning = false;
    game.currentQuestion = null;
    ordenPreguntas.delete(game); // la nueva ronda baraja otra vez
    game.lastDice = null;
    game.rolledBy = null;
    game.lastResult = null;
    game.winner = null;
    game.history = [];
    game.round++;
    game.currentTeamIndex = TEAM_COLORS.indexOf(game.activeTeams[0]);
    setPhase(game, "roll", game.rollSeconds);

    game.players.forEach((p) => {
      game.positions[p.id] = -1;
    });

    TEAM_COLORS.forEach((color) => {
      const team = game.teams[color];
      team.score = 0;
      team.correct = 0;
      team.incorrect = 0;
      bg(db.prepare("UPDATE teams SET score=0, correct=0, incorrect=0 WHERE id=?").run(team.id));
    });

    bg(db.prepare("UPDATE games SET phase = ?, winner_team = NULL, end_reason = NULL, finished_at = NULL WHERE id = ?").run("lobby", game.id));
    bg(db.prepare("DELETE FROM turn_history WHERE game_id = ?").run(game.id));

    broadcast(code);
  });
});

// ============================================================================
// MOVIMIENTO DE LA FICHA
// ============================================================================
// Si el equipo ACIERTA, su ficha avanza tantas casillas como marcó el dado.
//   - Desde casa (-1) sale a su casilla de salida y cuenta desde ahí.
//   - Para entrar a la meta hace falta el número exacto.
//   - Si cae sobre una ficha rival (y no es casilla segura), se la come.
// ============================================================================
function movePiece(game, playerId, team, dice) {
  const from = game.positions[playerId] ?? -1;
  const target = from < 0 ? dice - 1 : from + dice;

  if (target > GOAL_STEP) {
    return { moved: false, from, to: from, captured: [], reachedGoal: false };
  }

  game.positions[playerId] = target;

  const captured = [];
  const myRing = ringIndexForStep(team, target);
  if (myRing !== null && !SAFE_INDEXES.includes(myRing)) {
    game.players.forEach((rival) => {
      if (rival.id === playerId || rival.team === team) return;
      const rivalRing = ringIndexForStep(rival.team, game.positions[rival.id] ?? -1);
      if (rivalRing !== null && rivalRing === myRing) {
        game.positions[rival.id] = -1;
        captured.push(rival.name);
      }
    });
  }

  return { moved: true, from, to: target, captured, reachedGoal: target === GOAL_STEP };
}

// Resuelve la pregunta activa (alguien respondió, o se acabó el tiempo).
function resolveAnswer(game, code, currentTeam, playerId, optionIndex) {
  const timedOut = optionIndex === null || optionIndex === undefined;
  const isCorrect = !timedOut && optionIndex === game.currentQuestion.answerIndex;
  const team = game.teams[currentTeam];
  let pointsEarned = 0;
  let move = null;

  if (isCorrect) {
    pointsEarned = Number((20 / 12).toFixed(2));
    team.score = Math.min(20, Number((team.score + pointsEarned).toFixed(2)));
    team.correct++;

    // Acierta -> avanza el número del dado.
    move = movePiece(game, playerId, currentTeam, game.lastDice);
  } else {
    team.incorrect++;
  }

  const mover = game.players.find((p) => p.id === playerId);
  const correctAnswerText = game.currentQuestion.options[game.currentQuestion.answerIndex];
  game.lastResult = {
    team: currentTeam,
    isCorrect,
    timedOut,
    selectedIndex: timedOut ? null : optionIndex,
    correctIndex: game.currentQuestion.answerIndex,
    correctText: correctAnswerText,
    points: pointsEarned,
    playerName: mover?.name ?? null,
    move,
  };

  game.history.unshift({
    turn: game.turnCounter,
    team: currentTeam,
    dice: game.lastDice,
    topic: game.currentQuestion.topic,
    correct: isCorrect,
    timedOut,
    points: pointsEarned,
    correctAnswer: correctAnswerText,
    from: move?.from ?? null,
    to: move?.to ?? null,
  });

  bg(
    db
      .prepare("INSERT INTO turn_history (game_id, turn, team, dice, question_id, correct, points) VALUES (?,?,?,?,?,?,?)")
      .run(game.id, game.turnCounter, currentTeam, game.lastDice, game.currentQuestion.id, isCorrect ? 1 : 0, pointsEarned)
  );
  bg(
    db
      .prepare("UPDATE teams SET score=?, correct=?, incorrect=? WHERE id=?")
      .run(team.score, team.correct, team.incorrect, game.teams[currentTeam].id)
  );

  // ¿Ganó la partida al llegar a la meta?
  if (move?.reachedGoal) {
    game.winner = currentTeam;
    game.phase = "finished";
    game.timerRunning = false;
    game.awaitingAnswer = false;
    persistFinish(game, "goal");
    broadcast(code);
    return;
  }

  // Mostramos el resultado unos segundos y el reloj pasará solo al siguiente turno.
  setPhase(game, "result", RESULT_SECONDS);
  broadcast(code);
}

// ============================================================================
// EL RELOJ: un tick por segundo mueve la partida sola
// ============================================================================
setInterval(() => {
  games.forEach((game, code) => {
    // Cronómetro general de la clase (lo activa el docente)
    if (game.timerRunning && game.timerSeconds > 0) {
      game.timerSeconds--;
      io.to(code).emit("timer", game.timerSeconds);
      if (game.timerSeconds === 0) {
        game.timerRunning = false;
        game.phase = "finished";
        game.currentQuestion = null;
        persistFinish(game, "time");
        broadcast(code);
        return;
      }
    }

    if (game.phase !== "playing") return;

    game.phaseSecondsLeft--;
    io.to(code).emit("phase-timer", { turnPhase: game.turnPhase, seconds: game.phaseSecondsLeft });

    if (game.phaseSecondsLeft > 0) return;

    // Se acabó el tiempo de la fase: avanzamos sola a la siguiente.
    switch (game.turnPhase) {
      case "roll":
        rollDice(game, code, null); // nadie lanzó: lanza el servidor
        break;
      case "rolling":
        startQuestion(game, code);
        break;
      case "question":
        resolveAnswer(game, code, TEAM_COLORS[game.currentTeamIndex], null, null);
        break;
      case "result":
        nextTurn(game, code);
        break;
    }
  });
}, 1000);

// El reloj del crucigrama es independiente del de Ludo (partidas distintas, ambas en memoria).
setInterval(() => crosswordTick(io), 1000);
setInterval(() => quizTick(io), 1000); // reloj de la Evaluación rápida

// Limpieza cada 10 min: las partidas de más de 12 h salen de la memoria (el Map crecía sin límite).
setInterval(() => {
  const limite = Date.now() - 12 * 60 * 60 * 1000;
  for (const [code, g] of games) {
    if (g.createdAt && g.createdAt < limite) {
      games.delete(code);
      bg(db.prepare("UPDATE games SET phase = 'finished', end_reason = 'expired', finished_at = now() WHERE id = ? AND phase <> 'finished'").run(g.id));
    }
  }
  purgeOldRooms(limite);
  purgeOldQuizzes(limite);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Servidor YachayPlay escuchando en puerto ${PORT}`));
