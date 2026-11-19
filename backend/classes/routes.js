// ============================================================================
// CLASES (curso + sección) — /api/classes
// ============================================================================
//   GET    /api/classes                 mis clases (docente: las que dicta; estudiante: donde está inscrito)
//   POST   /api/classes                 (docente) { name, section } crea una clase
//   POST   /api/classes/join            (estudiante) { code } se inscribe con el código de la clase
//   GET    /api/classes/:id             detalle (dueño o miembro): actividades en vivo e historial;
//                                       el dueño ve además el código y la lista de estudiantes
//   PATCH  /api/classes/:id             (dueño) { name, section }
//   POST   /api/classes/:id/code        (dueño) genera un código de inscripción nuevo
//   DELETE /api/classes/:id             (dueño) archiva la clase (no borra el historial)
//   DELETE /api/classes/:id/members/:userId   el dueño quita a un estudiante, o el estudiante se sale ("me")
//
// Las partidas se asocian a una clase mandando `classId` al crearlas (Ludo, Crucigrama,
// Evaluación y Presentaciones): cada ruta lo valida con claseDelDocente().
// ============================================================================
import crypto from "node:crypto";
import { Router } from "express";
import { nanoid } from "nanoid";
import db from "../db.js";
import { actividadesEnVivo } from "./live.js";

export const classesRouter = Router();

const MAX_CLASES = 60; // activas por docente
const MAX_MIEMBROS = 400;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I/L
const RE_CODIGO = /^[A-HJ-NP-Z2-9]{6}$/;

const nuevoCodigo = () => Array.from({ length: 6 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join("");
export const limpiarCodigoClase = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Evita que una excepción deje la petición colgada (Express 4 no captura errores async).
const ruta = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(`Error en ${req.method} ${req.originalUrl}:`, e.message);
    if (!res.headersSent) res.status(500).json({ error: "Ocurrió un problema en el servidor. Inténtalo de nuevo." });
  });
};

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Inicia sesión para ver tus clases." });
  next();
}
const esDocente = (req) => req.user?.role === "docente";

// La clase si `userId` es su docente y no está archivada; si no, null.
// La usan las rutas de creación de cada juego para validar el `classId` que llega.
export async function claseDelDocente(classId, userId) {
  if (typeof classId !== "string" || !classId || !userId) return null;
  return (await db.prepare("SELECT id, name FROM classes WHERE id = ? AND owner_id = ? AND archived_at IS NULL").get(classId, userId)) || null;
}

// Rol del usuario en la clase: "owner" | "member" | null (y la fila de la clase).
async function accesoA(classId, user) {
  const c = await db
    .prepare(
      `SELECT c.*, u.name AS teacher_name FROM classes c JOIN users u ON u.id = c.owner_id
        WHERE c.id = ? AND c.archived_at IS NULL`
    )
    .get(classId);
  if (!c) return { clase: null, rol: null };
  if (c.owner_id === user.id) return { clase: c, rol: "owner" };
  const m = await db.prepare("SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ?").get(classId, user.id);
  return { clase: c, rol: m ? "member" : null };
}

// Lo que ve el estudiante de una actividad en vivo (sin nada que no pueda ver ya con el código).
const actividadPublica = ({ kind, code, name, status, players }) => ({ kind, code, name, status, players });

function agruparEnVivo(ids) {
  const porClase = new Map(ids.map((id) => [id, []]));
  for (const a of actividadesEnVivo(ids)) porClase.get(a.classId)?.push(actividadPublica(a));
  return porClase;
}

// ------------------------------ freno para el código ------------------------------
// 10 códigos incorrectos cada 10 minutos por usuario (si no, se podrían adivinar).
const fallosCodigo = new Map(); // userId -> { n, inicio }
setInterval(() => {
  const limite = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of fallosCodigo) if (v.inicio < limite) fallosCodigo.delete(k);
}, 10 * 60 * 1000).unref();
function demasiadosFallos(userId) {
  const f = fallosCodigo.get(userId);
  return !!f && Date.now() - f.inicio < 10 * 60 * 1000 && f.n >= 10;
}
function sumarFallo(userId) {
  const f = fallosCodigo.get(userId);
  if (!f || Date.now() - f.inicio >= 10 * 60 * 1000) fallosCodigo.set(userId, { n: 1, inicio: Date.now() });
  else f.n += 1;
}

classesRouter.use(requireUser);

// ------------------------------ mis clases ------------------------------
classesRouter.get("/", ruta(async (req, res) => {
  if (esDocente(req)) {
    const filas = await db
      .prepare(
        `SELECT c.id, c.name, c.section, c.join_code, c.created_at,
                (SELECT COUNT(*)::int FROM class_members m WHERE m.class_id = c.id) AS members,
                (SELECT COUNT(*)::int FROM games g WHERE g.class_id = c.id)
                  + (SELECT COUNT(*)::int FROM crossword_games g WHERE g.class_id = c.id) AS activities
           FROM classes c
          WHERE c.owner_id = ? AND c.archived_at IS NULL
          ORDER BY c.created_at DESC`
      )
      .all(req.user.id);
    const vivo = agruparEnVivo(filas.map((f) => f.id));
    return res.json({
      classes: filas.map((f) => ({
        id: f.id, name: f.name, section: f.section, code: f.join_code, members: f.members, activities: f.activities,
        createdAt: f.created_at, live: vivo.get(f.id) || [],
      })),
    });
  }
  const filas = await db
    .prepare(
      `SELECT c.id, c.name, c.section, u.name AS teacher, m.joined_at
         FROM class_members m
         JOIN classes c ON c.id = m.class_id AND c.archived_at IS NULL
         JOIN users u ON u.id = c.owner_id
        WHERE m.user_id = ?
        ORDER BY m.joined_at DESC`
    )
    .all(req.user.id);
  const vivo = agruparEnVivo(filas.map((f) => f.id));
  res.json({
    classes: filas.map((f) => ({ id: f.id, name: f.name, section: f.section, teacher: f.teacher, joinedAt: f.joined_at, live: vivo.get(f.id) || [] })),
  });
}));

// ------------------------------ crear (docente) ------------------------------
classesRouter.post("/", ruta(async (req, res) => {
  if (!esDocente(req)) return res.status(403).json({ error: "Solo las cuentas de docente pueden crear clases." });
  const name = texto(req.body?.name, 80);
  const section = texto(req.body?.section, 40);
  if (!name) return res.status(400).json({ error: "Escribe el nombre de la clase." });
  const { c } = await db.prepare("SELECT COUNT(*)::int AS c FROM classes WHERE owner_id = ? AND archived_at IS NULL").get(req.user.id);
  if (c >= MAX_CLASES) return res.status(400).json({ error: `Puedes tener hasta ${MAX_CLASES} clases activas. Archiva alguna para crear otra.` });

  const id = nanoid();
  for (let intento = 0; ; intento++) {
    const code = nuevoCodigo();
    try {
      await db.prepare("INSERT INTO classes (id, owner_id, name, section, join_code) VALUES (?,?,?,?,?)").run(id, req.user.id, name, section, code);
      return res.status(201).json({ class: { id, name, section, code, members: 0, activities: 0, live: [] } });
    } catch (e) {
      if (e.code !== "23505" || intento >= 8) throw e; // código repetido: probamos otro
    }
  }
}));

// ------------------------------ inscribirse (estudiante) ------------------------------
classesRouter.post("/join", ruta(async (req, res) => {
  if (esDocente(req)) return res.status(403).json({ error: "Las cuentas de docente no se inscriben en clases. Crea la tuya desde Mis clases." });
  if (demasiadosFallos(req.user.id)) return res.status(429).json({ error: "Demasiados códigos incorrectos. Espera unos minutos e inténtalo otra vez." });
  const code = limpiarCodigoClase(req.body?.code);
  const clase = RE_CODIGO.test(code)
    ? await db
        .prepare(
          `SELECT c.id, c.name, c.section, u.name AS teacher FROM classes c JOIN users u ON u.id = c.owner_id
            WHERE c.join_code = ? AND c.archived_at IS NULL`
        )
        .get(code)
    : null;
  if (!clase) {
    sumarFallo(req.user.id);
    return res.status(404).json({ error: "No encontramos una clase con ese código. Revísalo con tu docente." });
  }
  const { n } = await db.prepare("SELECT COUNT(*)::int AS n FROM class_members WHERE class_id = ?").get(clase.id);
  if (n >= MAX_MIEMBROS) return res.status(400).json({ error: "Esa clase ya está llena." });
  await db.prepare("INSERT INTO class_members (class_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING").run(clase.id, req.user.id);
  res.json({ class: { id: clase.id, name: clase.name, section: clase.section, teacher: clase.teacher, live: [] } });
}));

// ------------------------------ detalle ------------------------------
classesRouter.get("/:id", ruta(async (req, res) => {
  const { clase, rol } = await accesoA(String(req.params.id), req.user);
  if (!rol) return res.status(404).json({ error: "No encontramos esa clase." });

  const historial = await db
    .prepare(
      `SELECT * FROM (
         SELECT 'ludo' AS kind, g.name, g.code, g.phase AS status, g.created_at,
                (SELECT COUNT(*)::int FROM players p WHERE p.game_id = g.id) AS players
           FROM games g WHERE g.class_id = ?
         UNION ALL
         SELECT 'crucigrama' AS kind, g.name, g.code, g.status, g.created_at,
                (SELECT COUNT(*)::int FROM crossword_players p WHERE p.game_id = g.id) AS players
           FROM crossword_games g WHERE g.class_id = ?
       ) t ORDER BY created_at DESC LIMIT 20`
    )
    .all(clase.id, clase.id);

  const base = {
    id: clase.id,
    name: clase.name,
    section: clase.section,
    teacher: clase.teacher_name,
    role: rol,
    live: actividadesEnVivo([clase.id]).map(actividadPublica),
    history: historial.map((h) => ({
      kind: h.kind, name: h.name, status: h.status === "finished" || h.status === "ended" ? "ended" : "open",
      createdAt: h.created_at, players: h.players,
    })),
  };
  if (rol !== "owner") return res.json({ class: base });

  const miembros = await db
    .prepare(
      `SELECT u.id, u.name, m.joined_at FROM class_members m JOIN users u ON u.id = m.user_id
        WHERE m.class_id = ? ORDER BY u.name`
    )
    .all(clase.id);
  res.json({
    class: { ...base, code: clase.join_code, members: miembros.map((m) => ({ id: m.id, name: m.name, joinedAt: m.joined_at })) },
  });
}));

// ------------------------------ editar / código / archivar (dueño) ------------------------------
async function soloDueno(req, res) {
  const { clase, rol } = await accesoA(String(req.params.id), req.user);
  if (rol !== "owner") {
    res.status(404).json({ error: "No encontramos esa clase." });
    return null;
  }
  return clase;
}

classesRouter.patch("/:id", ruta(async (req, res) => {
  const clase = await soloDueno(req, res);
  if (!clase) return;
  const name = req.body?.name === undefined ? clase.name : texto(req.body.name, 80);
  const section = req.body?.section === undefined ? clase.section : texto(req.body.section, 40);
  if (!name) return res.status(400).json({ error: "Escribe el nombre de la clase." });
  await db.prepare("UPDATE classes SET name = ?, section = ? WHERE id = ?").run(name, section, clase.id);
  res.json({ ok: true, name, section });
}));

classesRouter.post("/:id/code", ruta(async (req, res) => {
  const clase = await soloDueno(req, res);
  if (!clase) return;
  for (let intento = 0; ; intento++) {
    const code = nuevoCodigo();
    try {
      await db.prepare("UPDATE classes SET join_code = ? WHERE id = ?").run(code, clase.id);
      return res.json({ code });
    } catch (e) {
      if (e.code !== "23505" || intento >= 8) throw e;
    }
  }
}));

// Archivar en vez de borrar: el historial de partidas y las estadísticas se conservan.
classesRouter.delete("/:id", ruta(async (req, res) => {
  const clase = await soloDueno(req, res);
  if (!clase) return;
  await db.prepare("UPDATE classes SET archived_at = now() WHERE id = ?").run(clase.id);
  res.json({ ok: true });
}));

classesRouter.delete("/:id/members/:userId", ruta(async (req, res) => {
  const { clase, rol } = await accesoA(String(req.params.id), req.user);
  if (!rol) return res.status(404).json({ error: "No encontramos esa clase." });
  const objetivo = req.params.userId === "me" ? req.user.id : String(req.params.userId);
  // El dueño puede quitar a cualquiera; un estudiante solo a sí mismo.
  if (rol !== "owner" && objetivo !== req.user.id) return res.status(403).json({ error: "No puedes quitar a otro estudiante." });
  await db.prepare("DELETE FROM class_members WHERE class_id = ? AND user_id = ?").run(clase.id, objetivo);
  res.json({ ok: true });
}));
