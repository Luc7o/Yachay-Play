import express from "express";

import "./env.js"; // carga backend/.env antes que cualquier otro módulo
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { nanoid, customAlphabet } from "nanoid";
import db from "./db.js";
import { ensureQuestions, reloadQuestions, poolFor, questionsRouter } from "./questionBank.js";
import { statsRouter } from "./stats.js";
import { profileRouter } from "./profile.js";
import { GOAL_STEP, SAFE_INDEXES, ringIndexForStep } from "./board.js";
import { authRouter, authOptional, requireTeacher } from "./auth.js";
import { userFromToken } from "./authCore.js";
import { seedDemoUsers } from "./seed.js";
import { crosswordRouter } from "./crossword/routes.js";
import { restoreCrosswordRooms } from "./crossword/persist.js";
import { assistantRouter } from "./assistant.js";
import { attachCrosswordSocket, crosswordTick } from "./crossword/sockets.js";
import { purgeOldRooms } from "./crossword/engine.js";

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
app.set("trust proxy", 1); // detrás de un proxy (Render, Railway...) req.ip debe ser la IP real
const ORIGENES = (process.env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(ORIGENES.length ? { origin: ORIGENES } : undefined));
app.use(express.json());
app.use(authOptional); // deja el usuario de la sesión (si hay) en req.user
app.use("/api/auth", authRouter);
app.use("/api/crossword-games", crosswordRouter); // juego nuevo: Crucigrama Relámpago
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

const cuentasNuevas = await seedDemoUsers();
if (cuentasNuevas.length) console.log(`Cuentas de prueba creadas: ${cuentasNuevas.join(", ")}`);

function publicState(game) {
  const { currentQuestion, ownerId, createdAt, ...rest } = game; // no exponemos el id del docente
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

function broadcast(code) {
  const game = games.get(code);
  if (game) io.to(code).emit("state", publicState(game));
}

// ---------------------- REST API ----------------------

// Solo un docente con sesión iniciada puede crear partidas.
app.post("/api/games", requireTeacher, async (req, res) => {
  try {
  const { name, counts, minutes, answerSeconds, rollSeconds } = req.body;
  if (!name || !counts) return res.status(400).json({ error: "name y counts son requeridos" });

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
          "INSERT INTO games (id, code, name, minutes, answer_seconds, roll_seconds, active_teams, owner_id) VALUES (?,?,?,?,?,?,?,?)"
        )
        .run(id, code, String(name).slice(0, 80), durationMinutes, answerLimit, rollLimit, activeTeams.join(","), req.user.id);
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
  res.json({ playerId, code: game.code });
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

/** Muestra la pregunta del turno. */
function startQuestion(game, code) {
  const pool = poolFor(game.ownerId);
  game.currentQuestion = pool[(game.turnCounter - 1) % pool.length];
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
  if (game.ownerId && game.ownerId !== u.id) {
    socket.emit("error-message", "Esta partida pertenece a otro docente.");
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
    const delta = Number(seconds) || 0;
    game.timerSeconds = Math.max(0, Math.min(180 * 60, game.timerSeconds + delta));
    broadcast(code);
  });

  // Volver a poner el reloj en la duración elegida al crear la partida
  socket.on("engineer:reset-timer", ({ code, minutes }) => {
    const game = teacherGame(socket, code);
    if (!game) return;
    if (minutes) game.durationMinutes = Math.min(180, Math.max(1, Number(minutes)));
    game.timerSeconds = game.durationMinutes * 60;
    game.timerRunning = false;
    broadcast(code);
  });

  // Cambiar en caliente los segundos para responder / para lanzar el dado
  socket.on("engineer:set-limits", ({ code, answerSeconds, rollSeconds }) => {
    const game = teacherGame(socket, code);
    if (!game) return;
    if (answerSeconds) game.answerTimeLimit = Math.min(120, Math.max(5, Number(answerSeconds)));
    if (rollSeconds) game.rollSeconds = Math.min(60, Math.max(3, Number(rollSeconds)));
    broadcast(code);
  });

  // ------------------------------------------------------------------
  // EL ALUMNO LANZA EL DADO desde su celular
  // ------------------------------------------------------------------
  socket.on("player:roll-dice", ({ code, playerId }) => {
    const game = games.get(code);
    if (!game || game.phase !== "playing" || game.turnPhase !== "roll") return;

    const player = game.players.find((p) => p.id === playerId);
    if (!player || player.team !== TEAM_COLORS[game.currentTeamIndex]) return;

    rollDice(game, code, player.name);
  });

  // Cualquier estudiante del equipo en turno puede responder; vale la primera respuesta
  socket.on("team:answer", ({ code, playerId, optionIndex }) => {
    const game = games.get(code);
    if (!game || game.turnPhase !== "question" || !game.currentQuestion) return;

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
    if (!game) return;
    game.phase = "finished";
    game.timerRunning = false;
    game.awaitingAnswer = false;
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
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Servidor YachayPlay escuchando en puerto ${PORT}`));
