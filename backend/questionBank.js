// ============================================================================
// BANCO DE PREGUNTAS (Ludo)
// ============================================================================
// - Preguntas OFICIALES: owner_id = NULL. Las ven todos los docentes (solo lectura).
// - Preguntas PROPIAS: owner_id = id del docente. Solo se usan en SUS partidas.
// Cada partida usa: oficiales + las propias activas de su docente.
// Las preguntas se guardan en memoria (cache) para que el juego no consulte la
// base de datos en cada turno; la cache se recarga cuando el docente edita algo.
// ============================================================================
import { Router } from "express";
import db from "./db.js";
import { buildQuestions } from "./questions.js";
import { requireTeacher } from "./auth.js";

export const LEVELS = ["Comprensión", "Aplicación", "Análisis", "Pensamiento Crítico"];
const MAX_PROPIAS = 100;

let cache = [];

const aPregunta = (q) => ({
  id: q.id,
  topic: q.topic,
  level: q.level,
  question: q.question,
  options: JSON.parse(q.options),
  answerIndex: q.answer_index,
  ownerId: q.owner_id || null,
  active: q.active,
});

// Siembra las 20 preguntas oficiales (solo si la tabla está vacía).
export async function ensureQuestions() {
  const { c } = await db.prepare("SELECT COUNT(*) AS c FROM questions WHERE owner_id IS NULL").get();
  if (c > 0) return;
  const insert = db.prepare(
    "INSERT INTO questions (topic, level, question, options, answer_index) VALUES (?,?,?,?,?)"
  );
  for (const q of buildQuestions()) {
    await insert.run(q.topic, q.level, q.question, JSON.stringify(q.options), q.answerIndex);
  }
}

export async function reloadQuestions() {
  const filas = await db.prepare("SELECT * FROM questions WHERE active = true ORDER BY id").all();
  cache = filas.map(aPregunta);
  return cache;
}

// Preguntas que puede usar un docente: oficiales + las suyas.
export const poolFor = (ownerId) => cache.filter((q) => q.ownerId === null || q.ownerId === ownerId);

// ------------------------------ validación ------------------------------
function validar(body) {
  const topic = String(body?.topic || "").trim().replace(/\s+/g, " ");
  const level = String(body?.level || "");
  const question = String(body?.question || "").trim();
  const options = Array.isArray(body?.options) ? body.options.map((o) => String(o ?? "").trim()) : [];
  const answerIndex = Number(body?.answerIndex);

  if (topic.length < 2 || topic.length > 60) return { error: "Escribe el tema (entre 2 y 60 letras)." };
  if (!LEVELS.includes(level)) return { error: "Elige un nivel válido." };
  if (question.length < 8 || question.length > 300) return { error: "La pregunta debe tener entre 8 y 300 caracteres." };
  if (options.length < 2 || options.length > 4) return { error: "Pon entre 2 y 4 opciones." };
  if (options.some((o) => !o || o.length > 120)) return { error: "Cada opción debe tener texto (máximo 120 caracteres)." };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return { error: "Las opciones no pueden repetirse." };
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
    return { error: "Marca cuál es la respuesta correcta." };
  }
  return { data: { topic, level, question, options, answerIndex } };
}

const aRespuesta = (q) => ({ ...q, mine: q.ownerId !== null });

// ------------------------------ rutas (solo docentes) ------------------------------
export const questionsRouter = Router();
questionsRouter.use(requireTeacher);

// Mis preguntas (con respuesta) + banco oficial (solo lectura).
questionsRouter.get("/", async (req, res) => {
  try {
    const filas = await db.prepare("SELECT * FROM questions WHERE owner_id IS NULL OR owner_id = ? ORDER BY id").all(req.user.id);
    const todas = filas.map(aPregunta).map(aRespuesta);
    res.json({
      levels: LEVELS,
      max: MAX_PROPIAS,
      mine: todas.filter((q) => q.mine),
      official: todas.filter((q) => !q.mine),
    });
  } catch (e) {
    console.error("Error leyendo preguntas:", e.message);
    res.status(500).json({ error: "No se pudieron cargar las preguntas." });
  }
});

questionsRouter.post("/", async (req, res) => {
  const { error, data } = validar(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const { c } = await db.prepare("SELECT COUNT(*) AS c FROM questions WHERE owner_id = ?").get(req.user.id);
    if (c >= MAX_PROPIAS) return res.status(400).json({ error: `Llegaste al máximo de ${MAX_PROPIAS} preguntas propias.` });
    await db
      .prepare("INSERT INTO questions (topic, level, question, options, answer_index, owner_id) VALUES (?,?,?,?,?,?)")
      .run(data.topic, data.level, data.question, JSON.stringify(data.options), data.answerIndex, req.user.id);
    await reloadQuestions();
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error("Error creando pregunta:", e.message);
    res.status(500).json({ error: "No se pudo guardar la pregunta." });
  }
});

questionsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Pregunta no válida." });
  const { error, data } = validar(req.body);
  if (error) return res.status(400).json({ error });
  const active = req.body?.active === undefined ? true : Boolean(req.body.active);
  try {
    const r = await db
      .prepare("UPDATE questions SET topic=?, level=?, question=?, options=?, answer_index=?, active=? WHERE id=? AND owner_id=?")
      .run(data.topic, data.level, data.question, JSON.stringify(data.options), data.answerIndex, active, id, req.user.id);
    if (!r.changes) return res.status(404).json({ error: "No encontré esa pregunta entre las tuyas." });
    await reloadQuestions();
    res.json({ ok: true });
  } catch (e) {
    console.error("Error editando pregunta:", e.message);
    res.status(500).json({ error: "No se pudo guardar la pregunta." });
  }
});

// Activar o desactivar sin borrar (una pregunta desactivada no sale en las partidas).
questionsRouter.patch("/:id/active", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Pregunta no válida." });
  try {
    const r = await db.prepare("UPDATE questions SET active=? WHERE id=? AND owner_id=?").run(Boolean(req.body?.active), id, req.user.id);
    if (!r.changes) return res.status(404).json({ error: "No encontré esa pregunta entre las tuyas." });
    await reloadQuestions();
    res.json({ ok: true });
  } catch (e) {
    console.error("Error cambiando estado:", e.message);
    res.status(500).json({ error: "No se pudo actualizar la pregunta." });
  }
});

questionsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Pregunta no válida." });
  try {
    const r = await db.prepare("DELETE FROM questions WHERE id=? AND owner_id=?").run(id, req.user.id);
    if (!r.changes) return res.status(404).json({ error: "No encontré esa pregunta entre las tuyas." });
    await reloadQuestions();
    res.json({ ok: true });
  } catch (e) {
    console.error("Error borrando pregunta:", e.message);
    res.status(500).json({ error: "No se pudo borrar la pregunta." });
  }
});
