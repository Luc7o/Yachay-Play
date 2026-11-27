// ============================================================================
// REGLAS DE LUDO (sin base de datos ni sockets)
// ============================================================================
// Lo que decide la partida y se puede probar solo: fases del turno, qué equipo
// sigue, cómo se mueve la ficha, qué pasa al responder y qué hace el reloj en
// cada segundo. server.js usa estas funciones y se encarga de guardar en la BD
// y de avisar por Socket.IO.
// ============================================================================
import { GOAL_STEP, SAFE_INDEXES, ringIndexForStep } from "../board.js";

export const TEAM_COLORS = ["rojo", "verde", "amarillo", "azul"];
// Puntos por acierto: 12 aciertos llegan a la nota máxima (20).
export const PUNTOS_POR_ACIERTO = Number((20 / 12).toFixed(2));
export const NOTA_MAXIMA = 20;

// Fases del turno: "roll" -> "rolling" -> "question" -> "result" -> (siguiente turno) "roll".
export function setPhase(game, turnPhase, seconds) {
  game.turnPhase = turnPhase;
  game.phaseSecondsLeft = seconds;
  game.awaitingAnswer = turnPhase === "question";
}

/**
 * Equipos que pueden jugar el turno: los que el docente activó Y que además
 * tienen al menos un alumno conectado. Si ninguno tiene alumnos todavía,
 * devolvemos todos los activos para que la rueda no se detenga.
 */
export function eligibleTeams(game) {
  const conAlumnos = game.activeTeams.filter((c) => game.players.some((p) => p.team === c));
  return conAlumnos.length ? conAlumnos : game.activeTeams;
}

// Índice (en TEAM_COLORS) del siguiente equipo que puede jugar, avanzando en orden.
// Si ninguno puede, se queda el actual.
export function siguienteEquipo(game) {
  const elegibles = eligibleTeams(game);
  for (let i = 1; i <= TEAM_COLORS.length; i++) {
    const idx = (game.currentTeamIndex + i) % TEAM_COLORS.length;
    if (elegibles.includes(TEAM_COLORS[idx])) return idx;
  }
  return game.currentTeamIndex;
}

// ============================================================================
// MOVIMIENTO DE LA FICHA
// ============================================================================
// Si el equipo ACIERTA, su ficha avanza tantas casillas como marcó el dado.
//   - Desde casa (-1) sale a su casilla de salida y cuenta desde ahí.
//   - Para entrar a la meta hace falta el número exacto.
//   - Si cae sobre una ficha rival (y no es casilla segura), se la come.
// ============================================================================
export function movePiece(game, playerId, team, dice) {
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

// Aplica la respuesta a la pregunta activa (o el fallo por tiempo, si optionIndex es
// null/undefined): puntos del equipo, movimiento de la ficha, `lastResult` e historial.
// Devuelve lo que server.js necesita para guardar y decidir si alguien ganó.
export function aplicarRespuesta(game, currentTeam, playerId, optionIndex) {
  const q = game.currentQuestion;
  const timedOut = optionIndex === null || optionIndex === undefined;
  const isCorrect = !timedOut && optionIndex === q.answerIndex;
  const team = game.teams[currentTeam];
  let pointsEarned = 0;
  let move = null;

  if (isCorrect) {
    pointsEarned = PUNTOS_POR_ACIERTO;
    team.score = Math.min(NOTA_MAXIMA, Number((team.score + pointsEarned).toFixed(2)));
    team.correct++;
    move = movePiece(game, playerId, currentTeam, game.lastDice); // acierta -> avanza el número del dado
  } else {
    team.incorrect++;
  }

  const mover = game.players.find((p) => p.id === playerId);
  const correctAnswerText = q.options[q.answerIndex];
  game.lastResult = {
    team: currentTeam,
    isCorrect,
    timedOut,
    selectedIndex: timedOut ? null : optionIndex,
    correctIndex: q.answerIndex,
    correctText: correctAnswerText,
    points: pointsEarned,
    playerName: mover?.name ?? null,
    move,
  };

  game.history.unshift({
    turn: game.turnCounter,
    team: currentTeam,
    dice: game.lastDice,
    topic: q.topic,
    correct: isCorrect,
    timedOut,
    points: pointsEarned,
    correctAnswer: correctAnswerText,
    from: move?.from ?? null,
    to: move?.to ?? null,
  });

  return { isCorrect, timedOut, pointsEarned, move, team };
}

// Un segundo del reloj de la partida. Cambia los contadores y devuelve qué pasó,
// para que server.js avise y actúe:
//   timer:            segundos que quedan del cronómetro general (si está corriendo)
//   terminoPorTiempo: el cronómetro llegó a 0 y la partida terminó
//   fase:             { turnPhase, seconds } de la fase en curso (si se está jugando)
//   vencio:           la fase cuyo tiempo se acabó ("roll" | "rolling" | "question" | "result")
export function pasoDelReloj(game) {
  const paso = {};
  if (game.timerRunning && game.timerSeconds > 0) {
    game.timerSeconds--;
    paso.timer = game.timerSeconds;
    if (game.timerSeconds === 0) {
      game.timerRunning = false;
      game.phase = "finished";
      game.currentQuestion = null;
      paso.terminoPorTiempo = true;
      return paso;
    }
  }
  if (game.phase !== "playing") return paso;
  game.phaseSecondsLeft--;
  paso.fase = { turnPhase: game.turnPhase, seconds: game.phaseSecondsLeft };
  if (game.phaseSecondsLeft <= 0) paso.vencio = game.turnPhase;
  return paso;
}
