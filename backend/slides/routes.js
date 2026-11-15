// ============================================================================
// RUTAS HTTP DE "PRESENTACIONES EN VIVO"
//   POST /api/slides        -> el docente crea la sala
//   GET  /api/slides/:code  -> cualquiera consulta si el código existe (pantalla de entrada)
// Todo lo demás (editar, comentar, bloquear) va por Socket.IO (sockets.js).
// ============================================================================
import { Router } from "express";
import { requireTeacher } from "../auth.js";
import { createRoom, getRoom } from "./engine.js";

export const slidesRouter = Router();

slidesRouter.post("/", requireTeacher, (req, res) => {
  const room = createRoom({ name: req.body?.name, task: req.body?.task, ownerId: req.user.id });
  res.status(201).json({ code: room.code, name: room.name, task: room.task });
});

slidesRouter.get("/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "No existe una sala con ese código." });
  res.json({ code: room.code, name: room.name, task: room.task, status: room.status, students: room.students.size });
});
