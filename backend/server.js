import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { nanoid, customAlphabet } from "nanoid";
import db from "./db.js";
import { buildQuestions } from "./questions.js";
import { GOAL_STEP, SAFE_INDEXES, ringIndexForStep } from "./board.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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

// --- Siembra del banco de preguntas (una sola vez) ---
function ensureQuestions() {
  const { c } = db.prepare("SELECT COUNT(*) AS c FROM questions").get();
  if (c === 0) {
    const insert = db.prepare(
      "INSERT INTO questions (topic, level, question, options, answer_index) VALUES (?,?,?,?,?)"
    );
    buildQuestions().forEach((q) => insert.run(q.topic, q.level, q.question, JSON.stringify(q.options), q.answerIndex));
  }
}
ensureQuestions();

// OJO: en SQLite la columna se llama answer_index (con guion bajo). Aquí la
// renombramos a answerIndex para poder comparar `optionIndex === q.answerIndex`.
function loadQuestions() {
  return db
    .prepare("SELECT * FROM questions ORDER BY id")
    .all()
    .map((q) => ({
      id: q.id,
      topic: q.topic,
      level: q.level,
      question: q.question,
      options: JSON.parse(q.options),
      answerIndex: q.answer_index,
    }));
}
const QUESTIONS = loadQuestions();

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
function restoreGamesFromDb() {
  const filas = db.prepare("SELECT * FROM games WHERE phase <> 'finished'").all();
  filas.forEach((g) => {
    const equipos = db.prepare("SELECT * FROM teams WHERE game_id = ?").all(g.id);
    const jugadores = db.prepare("SELECT * FROM players WHERE game_id = ?").all(g.id);
    const activeTeams = String(g.active_teams || "rojo,verde,amarillo,azul")
      .split(",")
      .filter((c) => TEAM_COLORS.includes(c));
    if (activeTeams.length < 2) return;

    const teams = {};
    equipos.forEach((t) => {
      teams[t.color] = { id: t.id, slots: t.slots, score: t.score, correct: t.correct, incorrect: t.incorrect };
    });
    if (TEAM_COLORS.some((c) => !teams[c])) return; // partida incompleta, la ignoramos

    const positions = {};
    jugadores.forEach((p) => {
      positions[p.id] = -1; // las fichas vuelven a casa: se reinicia la ronda
    });

    games.set(g.code, {
      id: g.id,
      code: g.code,
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
    });
  });
  if (games.size) console.log(`Partidas recuperadas de la base de datos: ${[...games.keys()].join(", ")}`);
}
restoreGamesFromDb();

function publicState(game) {
  const { currentQuestion, ...rest } = game;
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

app.post("/api/games", (req, res) => {
  const { name, counts, minutes, answerSeconds, rollSeconds } = req.body;
  if (!name || !counts) return res.status(400).json({ error: "name y counts son requeridos" });

  // Un color con 0 cupos simplemente NO JUEGA. Hacen falta al menos 2 colores.
  const activeTeams = TEAM_COLORS.filter((c) => Number(counts[c]) > 0);
  if (activeTeams.length < 2) return res.status(400).json({ error: "Deben jugar al menos 2 colores" });

  const durationMinutes = Math.min(180, Math.max(1, Number(minutes) || DEFAULT_MINUTES));
  const answerLimit = Math.min(120, Math.max(5, Number(answerSeconds) || DEFAULT_ANSWER_SECONDS));
  const rollLimit = Math.min(60, Math.max(3, Number(rollSeconds) || DEFAULT_ROLL_SECONDS));

  const id = nanoid();
  const code = codeGen();
  db.prepare(
    "INSERT INTO games (id, code, name, minutes, answer_seconds, roll_seconds, active_teams) VALUES (?,?,?,?,?,?,?)"
  ).run(id, code, name, durationMinutes, answerLimit, rollLimit, activeTeams.join(","));

  const teams = {};
  TEAM_COLORS.forEach((color) => {
    const slots = Math.min(4, Math.max(0, Number(counts[color]) || 0));
    const teamId = nanoid();
    db.prepare("INSERT INTO teams (id, game_id, color, slots) VALUES (?,?,?,?)").run(teamId, id, color, slots);
    teams[color] = { id: teamId, slots, score: 0, correct: 0, incorrect: 0 };
  });

  games.set(code, {
    id,
    code,
    name,
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
});

app.get("/api/games/:code", (req, res) => {
  const game = games.get(req.params.code);
  if (!game) return res.status(404).json({ error: "Partida no encontrada" });
  res.json(publicState(game));
});

app.post("/api/games/:code/join", (req, res) => {
  const game = games.get(req.params.code);
  if (!game) return res.status(404).json({ error: "Partida no encontrada" });

  const { name, team } = req.body;
  if (!name || !TEAM_COLORS.includes(team)) return res.status(400).json({ error: "Datos inválidos" });
  if (!game.activeTeams.includes(team)) return res.status(400).json({ error: "Ese color no juega en esta partida" });
  if (game.phase !== "lobby") return res.status(400).json({ error: "La partida ya inició" });

  const currentInTeam = game.players.filter((p) => p.team === team).length;
  if (currentInTeam >= game.teams[team].slots) {
    return res.status(400).json({ error: "El equipo ya está completo" });
  }

  const playerId = nanoid();
  db.prepare("INSERT INTO players (id, game_id, team, name) VALUES (?,?,?,?)").run(playerId, game.id, team, name);
  game.players.push({ id: playerId, name, team });
  game.positions[playerId] = -1;

  broadcast(game.code);
  res.json({ playerId, code: game.code });
});

app.get("/api/questions", (_req, res) => {
  res.json(QUESTIONS.map(({ answerIndex, ...q }) => q));
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
  game.currentQuestion = QUESTIONS[(game.turnCounter - 1) % QUESTIONS.length];
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

io.on("connection", (socket) => {
  socket.on("join-room", ({ code }) => {
    const game = games.get(code);
    if (!game) return socket.emit("error-message", "Partida no encontrada");
    socket.join(code);
    socket.emit("state", publicState(game));
  });

  socket.on("engineer:start-game", ({ code }) => {
    const game = games.get(code);
    if (!game) return;
    game.phase = "playing";
    // El primer turno lo toma el primer equipo elegible.
    game.currentTeamIndex = TEAM_COLORS.indexOf(eligibleTeams(game)[0]);
    setPhase(game, "roll", game.rollSeconds);
    db.prepare("UPDATE games SET phase = ? WHERE id = ?").run("playing", game.id);
    broadcast(code);
  });

  socket.on("engineer:toggle-timer", ({ code }) => {
    const game = games.get(code);
    if (!game) return;
    game.timerRunning = !game.timerRunning;
    broadcast(code);
  });

  // ------------------------------------------------------------------
  // EL DOCENTE CONTROLA EL TIEMPO DE LA PARTIDA
  // ------------------------------------------------------------------
  // seconds puede ser positivo (agregar tiempo) o negativo (quitar tiempo)
  socket.on("engineer:add-time", ({ code, seconds }) => {
    const game = games.get(code);
    if (!game) return;
    const delta = Number(seconds) || 0;
    game.timerSeconds = Math.max(0, Math.min(180 * 60, game.timerSeconds + delta));
    broadcast(code);
  });

  // Volver a poner el reloj en la duración elegida al crear la partida
  socket.on("engineer:reset-timer", ({ code, minutes }) => {
    const game = games.get(code);
    if (!game) return;
    if (minutes) game.durationMinutes = Math.min(180, Math.max(1, Number(minutes)));
    game.timerSeconds = game.durationMinutes * 60;
    game.timerRunning = false;
    broadcast(code);
  });

  // Cambiar en caliente los segundos para responder / para lanzar el dado
  socket.on("engineer:set-limits", ({ code, answerSeconds, rollSeconds }) => {
    const game = games.get(code);
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
    const game = games.get(code);
    if (!game || game.phase !== "playing") return;
    nextTurn(game, code);
  });

  socket.on("engineer:end-game", ({ code }) => {
    const game = games.get(code);
    if (!game) return;
    game.phase = "finished";
    game.timerRunning = false;
    game.awaitingAnswer = false;
    db.prepare("UPDATE games SET phase = ? WHERE id = ?").run("finished", game.id);
    broadcast(code);
  });

  // ADMIN: volver a crear la partida SIN cambiar el código.
  socket.on("engineer:reset-game", ({ code }) => {
    const game = games.get(code);
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
      db.prepare("UPDATE teams SET score=0, correct=0, incorrect=0 WHERE id=?").run(team.id);
    });

    db.prepare("UPDATE games SET phase = ? WHERE id = ?").run("lobby", game.id);
    db.prepare("DELETE FROM turn_history WHERE game_id = ?").run(game.id);

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

  db.prepare(
    "INSERT INTO turn_history (game_id, turn, team, dice, question_id, correct, points) VALUES (?,?,?,?,?,?,?)"
  ).run(game.id, game.turnCounter, currentTeam, game.lastDice, game.currentQuestion.id, isCorrect ? 1 : 0, pointsEarned);
  db.prepare("UPDATE teams SET score=?, correct=?, incorrect=? WHERE id=?").run(
    team.score,
    team.correct,
    team.incorrect,
    game.teams[currentTeam].id
  );

  // ¿Ganó la partida al llegar a la meta?
  if (move?.reachedGoal) {
    game.winner = currentTeam;
    game.phase = "finished";
    game.timerRunning = false;
    game.awaitingAnswer = false;
    db.prepare("UPDATE games SET phase = ? WHERE id = ?").run("finished", game.id);
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

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Servidor Ludo Educativo escuchando en puerto ${PORT}`));
