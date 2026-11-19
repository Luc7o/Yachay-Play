// ============================================================================
// RUTAS HTTP DE "PRESENTACIONES EN VIVO"
//   POST   /api/slides                 -> el docente crea la sala
//   GET    /api/slides/mine            -> el docente lista TODAS las salas que creó
//   POST   /api/slides/mine/:id/abrir  -> el docente reabre una sala (aunque ya no esté en memoria)
//   DELETE /api/slides/mine/:id        -> el docente elimina una sala CERRADA
//   GET    /api/slides/:code           -> cualquiera consulta si el código existe (pantalla de entrada)
// Todo lo demás (editar, comentar, bloquear) va por Socket.IO (sockets.js).
// ============================================================================
import { Router } from "express";
import db from "../db.js";
import { requireTeacher } from "../auth.js";
import { createRoom, deleteRoom, getRoom, resumenLista, rooms, restaurar } from "./engine.js";
import { borrarSala } from "./persist.js";
import { claseDelDocente } from "../classes/routes.js";

export const slidesRouter = Router();

slidesRouter.post("/", requireTeacher, async (req, res) => {
  const classId = req.body?.classId;
  let clase = null;
  try {
    clase = classId ? await claseDelDocente(classId, req.user.id) : null;
  } catch {
    return res.status(500).json({ error: "No se pudo comprobar la clase. Intenta otra vez." });
  }
  if (classId && !clase) return res.status(404).json({ error: "No encontramos esa clase." });
  const room = createRoom({ name: req.body?.name, task: req.body?.task, ownerId: req.user.id, classId: clase?.id || null });
  res.status(201).json({ code: room.code, name: room.name, task: room.task });
});

// ---- Mis salas ----
const salaEnMemoria = (id) => [...rooms.values()].find((r) => r.id === id) || null;

slidesRouter.get("/mine", requireTeacher, async (req, res) => {
  const lista = new Map();
  // 1) Las guardadas en la base (incluye las que ya salieron de la memoria).
  try {
    const { rows } = await db.pool.query(
      `SELECT id, code, status, created_at,
              data->>'name' AS name, data->>'task' AS task,
              COALESCE(jsonb_array_length(data->'decks'), 0) AS decks,
              COALESCE(jsonb_array_length(data->'students'), 0) AS students
         FROM slide_rooms WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]
    );
    for (const r of rows) {
      lista.set(r.id, {
        id: r.id, code: r.code, name: r.name || "Presentaciones de la clase", task: r.task || "", status: r.status === "closed" ? "closed" : "open",
        createdAt: new Date(r.created_at).getTime(), students: Number(r.students), decks: Number(r.decks), slides: null,
      });
    }
  } catch (e) {
    console.error("[presentaciones] no se pudo leer la lista de salas:", e.message);
  }
  // 2) Las que están en memoria (más al día que la base).
  for (const room of rooms.values()) if (room.ownerId === req.user.id && !room.deleted) lista.set(room.id, resumenLista(room));
  res.json({ rooms: [...lista.values()].sort((a, b) => b.createdAt - a.createdAt) });
});

slidesRouter.post("/mine/:id/abrir", requireTeacher, async (req, res) => {
  let room = salaEnMemoria(req.params.id);
  if (!room) {
    try {
      const { rows } = await db.pool.query("SELECT data FROM slide_rooms WHERE id = $1 AND owner_id = $2", [req.params.id, req.user.id]);
      if (!rows.length) return res.status(404).json({ error: "No encontramos esa sala. Quizá ya fue eliminada." });
      if (getRoom(rows[0].data?.code)) return res.status(409).json({ error: "Otra sala activa usa ahora ese código. Inténtalo más tarde." });
      room = restaurar(rows[0].data);
    } catch (e) {
      console.error("[presentaciones] no se pudo reabrir la sala:", e.message);
      return res.status(500).json({ error: "No se pudo abrir la sala." });
    }
  }
  if (!room) return res.status(404).json({ error: "No se pudo abrir la sala." });
  if (room.ownerId !== req.user.id) return res.status(403).json({ error: "Esta sala pertenece a otro docente." });
  res.json({ code: room.code });
});

slidesRouter.delete("/mine/:id", requireTeacher, async (req, res) => {
  const id = req.params.id;
  const room = salaEnMemoria(id);
  try {
    if (room) {
      if (room.ownerId !== req.user.id) return res.status(403).json({ error: "Esta sala pertenece a otro docente." });
      if (room.status !== "closed") return res.status(409).json({ error: "Cierra la sala antes de eliminarla." });
      room.deleted = true; // el guardado automático deja de escribirla
      try {
        await borrarSala(id);
      } catch (e) {
        room.deleted = false;
        throw e;
      }
      deleteRoom(room);
      return res.json({ ok: true });
    }
    const { rows } = await db.pool.query("SELECT status, owner_id FROM slide_rooms WHERE id = $1", [id]);
    if (!rows.length) return res.json({ ok: true }); // ya no existe: da igual
    if (rows[0].owner_id !== req.user.id) return res.status(403).json({ error: "Esta sala pertenece a otro docente." });
    if (rows[0].status !== "closed") return res.status(409).json({ error: "Cierra la sala antes de eliminarla." });
    await borrarSala(id);
    res.json({ ok: true });
  } catch (e) {
    console.error("[presentaciones] no se pudo eliminar la sala:", e.message);
    res.status(500).json({ error: "No se pudo eliminar la sala. Inténtalo de nuevo." });
  }
});

slidesRouter.get("/:code", (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: "No existe una sala con ese código." });
  res.json({ code: room.code, name: room.name, task: room.task, status: room.status, students: room.students.size });
});
