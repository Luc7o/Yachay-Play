// ============================================================================
// RUTAS HTTP DE "CRUCIGRAMA RELÁMPAGO"
// ============================================================================
// Solo dos rutas, igual de simples que las de Ludo:
//   POST /api/crossword-games        -> el docente crea la partida
//   GET  /api/crossword-games/:code  -> cualquiera consulta si el código existe
//                                        (para la pantalla de "unirse")
// Todo lo que pasa DURANTE la partida (unirse de verdad, responder, sabotear)
// va por Socket.IO, en sockets.js.
// ============================================================================
import { Router } from "express";
import { requireTeacher } from "../auth.js";
import { createRoom, getRoom } from "./engine.js";
import { claseDelDocente } from "../classes/routes.js";

export const crosswordRouter = Router();

crosswordRouter.post("/", requireTeacher, async (req, res) => {
  const { name, minutes, wordCount, classId } = req.body || {};
  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins < 1 || mins > 60) {
    return res.status(400).json({ error: "La duración debe ser entre 1 y 60 minutos." });
  }
  // classId opcional: la partida queda en el historial de esa clase (solo si es del docente).
  let clase = null;
  try {
    clase = classId ? await claseDelDocente(classId, req.user.id) : null;
  } catch {
    return res.status(500).json({ error: "No se pudo comprobar la clase. Intenta otra vez." });
  }
  if (classId && !clase) return res.status(404).json({ error: "No encontramos esa clase." });
  const room = createRoom({
    name,
    ownerId: req.user.id,
    classId: clase?.id || null,
    minutes: mins,
    wordCount: Number(wordCount) || 12,
  });
  res.status(201).json({
    code: room.code,
    name: room.name,
    minutes: room.minutes,
    totalWords: room.grid.placements.length,
  });
});

crosswordRouter.get("/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "No existe una partida con ese código." });
  res.json({
    code: room.code,
    name: room.name,
    status: room.status,
    minutes: room.minutes,
    totalWords: room.grid.placements.length,
    players: room.players.size,
  });
});
