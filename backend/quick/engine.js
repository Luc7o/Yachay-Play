// ============================================================================
// MOTOR DE "EVALUACIÓN RÁPIDA"
// ============================================================================
// Preguntas de opción múltiple en vivo, pensadas para medir la comprensión en
// clase (entrada/salida de sesión, repaso antes de un tema, etc.).
// Flujo de una sala:  lobby -> question -> reveal -> question -> ... -> ended
//   - El docente inicia y pasa de pregunta a pregunta.
//   - Cada pregunta tiene un tiempo; se cierra sola al acabarse el tiempo o
//     cuando todos ya respondieron.
//   - Al cerrarse se revela la respuesta correcta y cómo votó el grupo.
// Todo vive en memoria (Map), igual que las demás partidas, y NO sabe nada de
// Express ni de Socket.IO (así se puede probar sola).
// ============================================================================
import crypto from "node:crypto";
import { crearRegistro } from "../live/salas.js";
import { limpiarTexto as clean, admitirNombre, reanudar, MENSAJES } from "../live/jugadores.js";

const registro = crearRegistro();
export const rooms = registro.salas; // code -> room

export const LIMITS = {
  maxQuestions: 30,
  minOptions: 2,
  maxOptions: 4,
  minSeconds: 5,
  maxSeconds: 300,
  maxPlayers: 300,
};
const BASE_POINTS = 100; // por acertar
const SPEED_POINTS = 50; // extra por responder rápido (proporcional al tiempo que sobraba)

// Valida y limpia las preguntas que manda el docente. Devuelve { questions } o { error }.
export function sanitizeQuestions(input) {
  if (!Array.isArray(input) || input.length === 0) return { error: "Agrega al menos una pregunta." };
  if (input.length > LIMITS.maxQuestions) return { error: `Máximo ${LIMITS.maxQuestions} preguntas por evaluación.` };
  const questions = [];
  for (let i = 0; i < input.length; i++) {
    const q = input[i] || {};
    const text = clean(q.text, 300);
    const options = (Array.isArray(q.options) ? q.options : []).map((o) => clean(o, 150)).filter(Boolean);
    const correct = Number(q.correct);
    const seconds = Math.round(Number(q.seconds));
    if (!text) return { error: `La pregunta ${i + 1} no tiene texto.` };
    if (options.length < LIMITS.minOptions || options.length > LIMITS.maxOptions) {
      return { error: `La pregunta ${i + 1} necesita entre ${LIMITS.minOptions} y ${LIMITS.maxOptions} opciones.` };
    }
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length)
      return { error: `La pregunta ${i + 1} tiene opciones repetidas.` };
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length)
      return { error: `Marca la respuesta correcta de la pregunta ${i + 1}.` };
    questions.push({
      text,
      options,
      correct,
      seconds: Number.isFinite(seconds) ? Math.min(LIMITS.maxSeconds, Math.max(LIMITS.minSeconds, seconds)) : 30,
    });
  }
  return { questions };
}

export function createRoom({ name, ownerId, classId = null, questions }) {
  const room = {
    id: crypto.randomUUID(),
    code: registro.nuevoCodigo(), // 6 dígitos, único en memoria
    name: clean(name, 60) || "Evaluación rápida",
    ownerId,
    classId, // clase a la que pertenece (o null)
    questions,
    status: "lobby", // lobby | question | reveal | ended
    qIndex: -1,
    deadline: null, // hora (ms) en que se cierra la pregunta abierta
    players: new Map(), // id -> { id, name, answers: { [qIndex]: { choice, ms, points } }, score }
    createdAt: Date.now(),
  };
  return registro.guardar(room);
}
export const getRoom = registro.obtener;

export function addPlayer(room, { id, name }) {
  const { jugador } = reanudar(room.players, { id }); // recargó la página: sigue siendo él
  if (jugador) return { player: jugador };
  const r = admitirNombre(room.players, name, { max: LIMITS.maxPlayers });
  if (r.error === MENSAJES.sinNombre) return r;
  if (room.status === "ended") return { error: "Esta evaluación ya terminó." };
  if (r.error) return r;
  const player = { id: crypto.randomUUID(), name: r.nombre, answers: {}, score: 0 };
  room.players.set(player.id, player);
  return { player };
}

// ---------------------------- flujo de la sala ----------------------------
function open(room, index) {
  room.status = "question";
  room.qIndex = index;
  room.deadline = Date.now() + room.questions[index].seconds * 1000;
}
export function start(room) {
  if (room.status !== "lobby") return { error: "La evaluación ya empezó." };
  if (room.players.size === 0) return { error: "Espera a que se una al menos un estudiante." };
  open(room, 0);
  return { ok: true };
}
// Cierra la pregunta abierta: calcula puntos de quienes respondieron.
export function closeQuestion(room) {
  if (room.status !== "question") return;
  const q = room.questions[room.qIndex];
  for (const p of room.players.values()) {
    const a = p.answers[room.qIndex];
    if (a && a.points == null) {
      a.points =
        a.choice === q.correct
          ? BASE_POINTS + Math.round(SPEED_POINTS * Math.max(0, 1 - a.ms / (q.seconds * 1000)))
          : 0;
      p.score += a.points;
    }
  }
  room.status = "reveal";
  room.deadline = null;
}
export function reveal(room) {
  if (room.status !== "question") return { error: "No hay una pregunta abierta." };
  closeQuestion(room);
  return { ok: true };
}
export function next(room) {
  if (room.status === "question") closeQuestion(room); // el docente adelanta: se cierra y pasa
  if (room.status === "lobby") return { error: "Primero inicia la evaluación." };
  if (room.status === "ended") return { error: "La evaluación ya terminó." };
  if (room.qIndex + 1 >= room.questions.length) {
    room.status = "ended";
    return { ok: true, ended: true };
  }
  open(room, room.qIndex + 1);
  return { ok: true };
}
export function end(room) {
  if (room.status === "ended") return { error: "La evaluación ya terminó." };
  closeQuestion(room);
  room.status = "ended";
  return { ok: true };
}
export function answer(room, playerId, choice) {
  const p = room.players.get(playerId);
  if (!p) return { error: "No estás en esta evaluación." };
  if (room.status !== "question") return { error: "No hay una pregunta abierta." };
  const q = room.questions[room.qIndex];
  if (Date.now() > room.deadline + 400) return { error: "Se acabó el tiempo." }; // pequeña tolerancia por la red
  if (p.answers[room.qIndex]) return { error: "Ya respondiste esta pregunta." };
  const c = Number(choice);
  if (!Number.isInteger(c) || c < 0 || c >= q.options.length) return { error: "Opción inválida." };
  p.answers[room.qIndex] = {
    choice: c,
    ms: Math.max(0, q.seconds * 1000 - (room.deadline - Date.now())),
    points: null,
  };
  return { ok: true };
}
// Reloj: cierra la pregunta si se acabó el tiempo o si ya respondieron todos.
export function tick(room) {
  if (room.status !== "question") return;
  const todos = room.players.size > 0 && [...room.players.values()].every((p) => p.answers[room.qIndex]);
  if (todos || Date.now() >= room.deadline) closeQuestion(room);
}

// ------------------------------ vistas públicas ------------------------------
// Solo cuentan las preguntas ya cerradas (points != null): si contara la que sigue
// abierta, el puesto delataría si la opción marcada es la correcta.
function ranking(room) {
  return [...room.players.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      correct: Object.entries(p.answers).filter(([i, a]) => a.points != null && a.choice === room.questions[i]?.correct)
        .length,
    }))
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
function distribution(room, qIndex) {
  const q = room.questions[qIndex];
  const counts = q.options.map(() => 0);
  for (const p of room.players.values()) {
    const a = p.answers[qIndex];
    if (a) counts[a.choice]++;
  }
  return counts;
}

// Lo que ve cada quien. A los estudiantes NUNCA se les manda la respuesta correcta
// mientras la pregunta está abierta; el docente sí la ve siempre (es suya).
export function publicState(room, playerId = null, isTeacher = false) {
  const base = {
    code: room.code,
    name: room.name,
    status: room.status,
    total: room.questions.length,
    qIndex: room.qIndex,
    players: room.players.size,
    now: Date.now(),
  };
  const rank = ranking(room);
  const showCorrect = isTeacher || room.status === "reveal" || room.status === "ended";
  if ((room.status === "question" || room.status === "reveal") && room.qIndex >= 0) {
    const q = room.questions[room.qIndex];
    base.question = {
      text: q.text,
      options: q.options,
      seconds: q.seconds,
      ...(showCorrect ? { correct: q.correct } : {}),
    };
    base.deadline = room.deadline;
    base.answered = [...room.players.values()].filter((p) => p.answers[room.qIndex]).length;
    if (isTeacher || room.status === "reveal") base.counts = distribution(room, room.qIndex);
  }
  if (room.status === "reveal" || room.status === "ended")
    base.top = rank.slice(0, 5).map(({ name, score, rank: r }) => ({ name, score, rank: r }));
  if (playerId) {
    const p = room.players.get(playerId);
    const r = rank.find((x) => x.id === playerId);
    if (p) {
      const a = p.answers[room.qIndex];
      base.me = {
        name: p.name,
        score: p.score,
        rank: r?.rank ?? null,
        choice: a ? a.choice : null,
        points: room.status === "reveal" && a ? a.points : null,
      };
    }
  }
  if (isTeacher) {
    base.ranking = rank.map(({ name, score, correct, rank: r }) => ({ name, score, correct, rank: r }));
    base.names = [...room.players.values()].map((p) => p.name);
  }
  if (room.status === "ended" && isTeacher) {
    // Resultado por pregunta: % de aciertos (sirve para ver qué tema no quedó claro)
    base.review = room.questions.map((q, i) => {
      const counts = distribution(room, i);
      const respondieron = counts.reduce((x, y) => x + y, 0);
      return {
        text: q.text,
        options: q.options,
        correct: q.correct,
        counts,
        respondieron,
        aciertos: counts[q.correct],
      };
    });
  }
  return base;
}

// Datos para exportar a Excel/CSV (solo docente).
export function exportRows(room) {
  const header = ["Estudiante", "Puntaje", "Aciertos", ...room.questions.map((_, i) => `P${i + 1}`)];
  const rows = ranking(room).map((r) => {
    const p = room.players.get(r.id);
    return [
      r.name,
      r.score,
      r.correct,
      ...room.questions.map((q, i) => (p.answers[i] ? (p.answers[i].choice === q.correct ? "✔" : "✘") : "—")),
    ];
  });
  return [header, ...rows];
}

export const purgeOldRooms = (limit) => registro.purgarViejas(limit);
