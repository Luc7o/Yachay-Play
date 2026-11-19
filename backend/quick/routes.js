// ============================================================================
// RUTAS HTTP DE "EVALUACIÓN RÁPIDA"
//   POST /api/quick-quizzes        -> el docente crea la sala con sus preguntas
//   GET  /api/quick-quizzes/:code  -> consulta si el código existe (pantalla de "unirse")
// Lo que pasa durante la evaluación va por Socket.IO (sockets.js).
// ============================================================================
import { Router } from "express";
import { requireTeacher } from "../auth.js";
import { createRoom, getRoom, sanitizeQuestions } from "./engine.js";
import { claseDelDocente } from "../classes/routes.js";

export const quickRouter = Router();

quickRouter.post("/", requireTeacher, async (req, res) => {
  const { name, questions, classId } = req.body || {};
  const r = sanitizeQuestions(questions);
  if (r.error) return res.status(400).json({ error: r.error });
  let clase = null;
  try {
    clase = classId ? await claseDelDocente(classId, req.user.id) : null;
  } catch {
    return res.status(500).json({ error: "No se pudo comprobar la clase. Intenta otra vez." });
  }
  if (classId && !clase) return res.status(404).json({ error: "No encontramos esa clase." });
  const room = createRoom({ name, ownerId: req.user.id, classId: clase?.id || null, questions: r.questions });
  res.status(201).json({ code: room.code, name: room.name, total: room.questions.length });
});

quickRouter.get("/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "No existe una evaluación con ese código." });
  res.json({ code: room.code, name: room.name, status: room.status, total: room.questions.length, players: room.players.size });
});
