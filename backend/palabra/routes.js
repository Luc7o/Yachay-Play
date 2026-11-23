// ============================================================================
// RUTAS HTTP DE "PALABRA RELÁMPAGO" EN LÍNEA
//   POST /api/palabra-games        -> cualquier persona con sesión crea una sala
//   GET  /api/palabra-games/:code  -> consulta si el código existe (pantalla de "unirse")
// Lo que pasa durante la partida va por Socket.IO (sockets.js).
//
// Quién puede qué:
//   - Docente: crea salas, las puede ligar a una clase y agregar palabras extra al diccionario.
//   - Estudiante: crea salas para jugar con sus compañeros, SIN palabras extra ni clase.
// ============================================================================
import { Router } from "express";
import { createRoom, getRoom, openRoomsOf, LIMITS } from "./engine.js";
import { claseDelDocente } from "../classes/routes.js";

export const palabraRouter = Router();

palabraRouter.post("/", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Inicia sesión para crear una partida." });
  const esDocente = req.user.role === "docente";
  if (openRoomsOf(req.user.id) >= LIMITS.maxOpenPerOwner) {
    return res.status(429).json({ error: "Ya tienes varias partidas abiertas. Termina alguna antes de crear otra." });
  }
  const { name, mode, seconds, maxRounds, teams, classId, extraWords, hostPlays } = req.body || {};
  let clase = null;
  if (esDocente && classId) {
    try {
      clase = await claseDelDocente(classId, req.user.id);
    } catch {
      return res.status(500).json({ error: "No se pudo comprobar la clase. Intenta otra vez." });
    }
    if (!clase) return res.status(404).json({ error: "No encontramos esa clase." });
  }
  const room = createRoom({
    name,
    ownerId: req.user.id,
    ownerName: req.user.name,
    classId: clase?.id || null,
    // El docente decide si participa; quien no es docente siempre juega.
    hostPlays: esDocente ? !!hostPlays : true,
    mode,
    seconds,
    maxRounds,
    teams,
    extraWords: esDocente ? extraWords : [], // las palabras extra son SOLO del docente
  });
  res.status(201).json({ code: room.code, name: room.name, hostPlays: room.hostPlays });
});

palabraRouter.get("/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "No existe una partida con ese código." });
  res.json({ code: room.code, name: room.name, status: room.status, mode: room.mode, players: room.players.size, host: room.ownerName });
});
