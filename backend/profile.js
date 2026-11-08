// ============================================================================
// PERFIL, RANKING Y LOGROS
// ============================================================================
//   GET   /api/profile           -> datos de la cuenta + resumen según el rol
//   PATCH /api/profile           -> cambiar el nombre
//   POST  /api/profile/password  -> cambiar la contraseña (pide la actual)
//   GET   /api/profile/ranking   -> ranking de estudiantes (top 10 + mi posición)
//
// PUNTOS DE TRAYECTORIA (solo cuentan partidas TERMINADAS, para que no se puedan
// "inflar" entrando a partidas vacías):   10 por victoria  +  2 por partida jugada.
// ============================================================================
import { Router } from "express";
import db from "./db.js";
import { hashPassword, verifyPassword, publicUser } from "./authCore.js";

export const profileRouter = Router();
export const PUNTOS_VICTORIA = 10;
export const PUNTOS_PARTIDA = 2;

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Inicia sesión para ver tu perfil." });
  next();
}
profileRouter.use(requireUser);

// ----------------------------- ranking -----------------------------
async function filasRanking() {
  const filas = await db
    .prepare(
      `WITH ludo AS (
         SELECT p.user_id, COUNT(*)::int AS played,
                COUNT(*) FILTER (WHERE g.winner_team = p.team)::int AS won
           FROM players p JOIN games g ON g.id = p.game_id
          WHERE p.user_id IS NOT NULL AND g.phase = 'finished'
          GROUP BY p.user_id),
       cw AS (
         SELECT p.user_id, COUNT(*)::int AS played,
                COUNT(*) FILTER (WHERE g.winner_player_id = p.id)::int AS won
           FROM crossword_players p JOIN crossword_games g ON g.id = p.game_id
          WHERE p.user_id IS NOT NULL AND g.status = 'ended'
          GROUP BY p.user_id)
       SELECT u.id, u.name,
              COALESCE(l.played, 0) + COALESCE(c.played, 0) AS played,
              COALESCE(l.won, 0) + COALESCE(c.won, 0) AS won
         FROM users u
         LEFT JOIN ludo l ON l.user_id = u.id
         LEFT JOIN cw c ON c.user_id = u.id
        WHERE u.role = 'estudiante' AND COALESCE(l.played, 0) + COALESCE(c.played, 0) > 0`
    )
    .all();
  return filas
    .map((f) => ({ ...f, points: f.won * PUNTOS_VICTORIA + f.played * PUNTOS_PARTIDA }))
    .sort((a, b) => b.points - a.points || b.won - a.won || a.name.localeCompare(b.name, "es"));
}

// En el ranking público solo se muestra el nombre (nunca el correo).
const aPublico = (f, i, miId) => ({ position: i + 1, name: f.name, played: f.played, won: f.won, points: f.points, me: f.id === miId });

profileRouter.get("/ranking", async (req, res) => {
  try {
    const filas = await filasRanking();
    const idx = filas.findIndex((f) => f.id === req.user.id);
    res.json({
      total: filas.length,
      top: filas.slice(0, 10).map((f, i) => aPublico(f, i, req.user.id)),
      me: idx >= 0 ? aPublico(filas[idx], idx, req.user.id) : null,
    });
  } catch (e) {
    console.error("Error en ranking:", e.message);
    res.status(500).json({ error: "No se pudo cargar el ranking." });
  }
});

// ----------------------------- logros -----------------------------
function logros({ played, won, correct, incorrect, cwBest, jugoLudo, jugoCw }) {
  const respuestas = correct + incorrect;
  const precision = respuestas ? correct / respuestas : 0;
  return [
    { id: "primero", icon: "🎮", name: "Primer juego", desc: "Termina tu primera partida.", unlocked: played >= 1 },
    { id: "victoria", icon: "🏆", name: "Primera victoria", desc: "Gana una partida.", unlocked: won >= 1 },
    { id: "constante", icon: "🔥", name: "Constante", desc: "Juega 5 partidas.", unlocked: played >= 5 },
    { id: "campeon", icon: "👑", name: "Campeón", desc: "Gana 5 partidas.", unlocked: won >= 5 },
    { id: "punteria", icon: "🎯", name: "Buena puntería", desc: "80 % de aciertos en Ludo (mínimo 10 respuestas).", unlocked: respuestas >= 10 && precision >= 0.8 },
    { id: "crucigramista", icon: "🔤", name: "Crucigramista", desc: "Resuelve 5 palabras o más en un crucigrama.", unlocked: cwBest >= 5 },
    { id: "todoterreno", icon: "🧩", name: "Todoterreno", desc: "Juega Ludo y Crucigrama.", unlocked: jugoLudo && jugoCw },
  ];
}

// ----------------------------- perfil -----------------------------
profileRouter.get("/", async (req, res) => {
  try {
    const u = await db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(req.user.id);
    const base = { user: { ...publicUser(u), created_at: u.created_at } };

    if (u.role === "docente") {
      const l = await db.prepare("SELECT COUNT(*)::int AS c FROM games WHERE owner_id = ?").get(u.id);
      const c = await db.prepare("SELECT COUNT(*)::int AS c FROM crossword_games WHERE owner_id = ?").get(u.id);
      const q = await db.prepare("SELECT COUNT(*)::int AS c FROM questions WHERE owner_id = ?").get(u.id);
      const e = await db
        .prepare(
          `SELECT COUNT(DISTINCT user_id)::int AS c FROM (
             SELECT p.user_id FROM players p JOIN games g ON g.id = p.game_id WHERE g.owner_id = ? AND p.user_id IS NOT NULL
             UNION ALL
             SELECT p.user_id FROM crossword_players p JOIN crossword_games g ON g.id = p.game_id WHERE g.owner_id = ? AND p.user_id IS NOT NULL
           ) x`
        )
        .get(u.id, u.id);
      return res.json({ ...base, docente: { ludoGames: l.c, crosswordGames: c.c, questions: q.c, students: e.c } });
    }

    const ludo = await db
      .prepare(
        `SELECT g.winner_team = p.team AS won, t.correct, t.incorrect
           FROM players p JOIN games g ON g.id = p.game_id
           JOIN teams t ON t.game_id = g.id AND t.color = p.team
          WHERE p.user_id = ? AND g.phase = 'finished'`
      )
      .all(u.id);
    const cw = await db
      .prepare(
        `SELECT (g.winner_player_id = p.id) AS won, p.solved_count
           FROM crossword_players p JOIN crossword_games g ON g.id = p.game_id
          WHERE p.user_id = ? AND g.status = 'ended'`
      )
      .all(u.id);

    const played = ludo.length + cw.length;
    const won = ludo.filter((g) => g.won).length + cw.filter((g) => g.won).length;
    const correct = ludo.reduce((a, g) => a + g.correct, 0);
    const incorrect = ludo.reduce((a, g) => a + g.incorrect, 0);
    const cwBest = cw.reduce((m, g) => Math.max(m, g.solved_count), 0);
    const filas = await filasRanking();
    const idx = filas.findIndex((f) => f.id === u.id);

    res.json({
      ...base,
      estudiante: {
        played,
        won,
        correct,
        incorrect,
        points: won * PUNTOS_VICTORIA + played * PUNTOS_PARTIDA,
        rank: idx >= 0 ? idx + 1 : null,
        totalRanked: filas.length,
        badges: logros({ played, won, correct, incorrect, cwBest, jugoLudo: ludo.length > 0, jugoCw: cw.length > 0 }),
      },
    });
  } catch (e) {
    console.error("Error en perfil:", e.message);
    res.status(500).json({ error: "No se pudo cargar tu perfil." });
  }
});

// ----------------------------- editar nombre -----------------------------
profileRouter.patch("/", async (req, res) => {
  const nombre = String(req.body?.name || "").trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 40) return res.status(400).json({ error: "Escribe tu nombre (entre 2 y 40 letras)." });
  try {
    await db.prepare("UPDATE users SET name = ? WHERE id = ?").run(nombre, req.user.id);
    res.json({ user: publicUser({ ...req.user, name: nombre }) });
  } catch (e) {
    console.error("Error al cambiar nombre:", e.message);
    res.status(500).json({ error: "No se pudo guardar el nombre." });
  }
});

// ----------------------------- cambiar contraseña -----------------------------
const intentos = new Map(); // userId -> { n, inicio }: 5 intentos fallidos cada 10 minutos
profileRouter.post("/password", async (req, res) => {
  const actual = String(req.body?.currentPassword || "");
  const nueva = String(req.body?.newPassword || "");
  const ahora = Date.now();
  const a = intentos.get(req.user.id);
  if (a && ahora - a.inicio < 10 * 60 * 1000 && a.n >= 5) {
    return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo otra vez." });
  }
  if (nueva.length < 6) return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
  if (nueva.length > 100) return res.status(400).json({ error: "La nueva contraseña es demasiado larga." });
  try {
    const u = await db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
    if (!verifyPassword(actual, u.password_hash)) {
      const previo = a && ahora - a.inicio < 10 * 60 * 1000 ? a : { n: 0, inicio: ahora };
      intentos.set(req.user.id, { n: previo.n + 1, inicio: previo.inicio });
      return res.status(401).json({ error: "La contraseña actual no es correcta." });
    }
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(nueva), req.user.id);
    intentos.delete(req.user.id);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error al cambiar contraseña:", e.message);
    res.status(500).json({ error: "No se pudo cambiar la contraseña." });
  }
});
