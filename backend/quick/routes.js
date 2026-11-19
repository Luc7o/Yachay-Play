// ============================================================================
// RUTAS HTTP DE "EVALUACIÓN RÁPIDA"
//   POST /api/quick-quizzes        -> el docente crea la sala con sus preguntas
//   GET  /api/quick-quizzes/:code  -> consulta si el código existe (pantalla de "unirse")
// Lo que pasa durante la evaluación va por Socket.IO (sockets.js).
// ============================================================================
import { Router } from "express";
import { requireTeacher } from "../auth.js";
import { createRoom, getRoom, sanitizeQuestions } from "./engine.js";

export const quickRouter = Router();

quickRouter.post("/", requireTeacher, (req, res) => {
  const { name, questions } = req.body || {};
  const r = sanitizeQuestions(questions);
  if (r.error) return res.status(400).json({ error: r.error });
  const room = createRoom({ name, ownerId: req.user.id, questions: r.questions });
  res.status(201).json({ code: room.code, name: room.name, total: room.questions.length });
});

quickRouter.get("/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "No existe una evaluación con ese código." });
  res.json({ code: room.code, name: room.name, status: room.status, total: room.questions.length, players: room.players.size });
});
