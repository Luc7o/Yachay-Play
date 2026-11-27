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
import { hashPassword, verifyPassword, publicUser, signToken, findUserById, validatePassword } from "./authCore.js";

export const profileRouter = Router();
export const PUNTOS_VICTORIA = 10;
export const PUNTOS_PARTIDA = 2;

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Inicia sesión para ver tu perfil." });
  next();
}
profileRouter.use(requireUser);

// ----------------------------- ranking -----------------------------
// COUNT(DISTINCT g.id): una misma cuenta unida varias veces a la misma partida
// cuenta como UNA partida jugada (y una sola victoria), no N.
// Los puntos y el puesto se calculan en SQL y solo vuelven el top 10 + la fila propia
// (antes se traían TODOS los estudiantes y se ordenaban en JS en cada visita al perfil).
export async function ranking(miId, limite = 10) {
  const filas = await db
    .prepare(
      `WITH ludo AS (
         SELECT p.user_id, COUNT(DISTINCT g.id)::int AS played,
                COUNT(DISTINCT g.id) FILTER (WHERE g.winner_team = p.team)::int AS won
           FROM players p JOIN games g ON g.id = p.game_id
          WHERE p.user_id IS NOT NULL AND g.phase = 'finished'
          GROUP BY p.user_id),
       cw AS (
         SELECT p.user_id, COUNT(DISTINCT g.id)::int AS played,
                COUNT(DISTINCT g.id) FILTER (WHERE g.winner_player_id = p.id)::int AS won
           FROM crossword_players p JOIN crossword_games g ON g.id = p.game_id
          WHERE p.user_id IS NOT NULL AND g.status = 'ended'
          GROUP BY p.user_id),
       base AS (
         SELECT u.id, u.name,
                COALESCE(l.played, 0) + COALESCE(c.played, 0) AS played,
                COALESCE(l.won, 0) + COALESCE(c.won, 0) AS won
           FROM users u
           LEFT JOIN ludo l ON l.user_id = u.id
           LEFT JOIN cw c ON c.user_id = u.id
          WHERE u.role = 'estudiante' AND COALESCE(l.played, 0) + COALESCE(c.played, 0) > 0),
       puntos AS (
         SELECT *, won * ? + played * ? AS points FROM base),
       ordenado AS (
         SELECT *, ROW_NUMBER() OVER (ORDER BY points DESC, won DESC, name) AS position,
                COUNT(*) OVER () AS total
           FROM puntos)
       SELECT id, name, played, won, points::int AS points, position::int AS position, total::int AS total
         FROM ordenado
        WHERE position <= ? OR id = ?
        ORDER BY position`,
    )
    .all(PUNTOS_VICTORIA, PUNTOS_PARTIDA, limite, miId);
  const total = filas[0]?.total ?? 0;
  const yo = filas.find((f) => f.id === miId) || null;
  return { total, top: filas.filter((f) => f.position <= limite), yo };
}

// En el ranking público solo se muestra el nombre (nunca el correo).
const aPublico = (f, miId) => ({
  position: f.position,
  name: f.name,
  played: f.played,
  won: f.won,
  points: f.points,
  me: f.id === miId,
});

profileRouter.get("/ranking", async (req, res) => {
  try {
    const r = await ranking(req.user.id);
    res.json({
      total: r.total,
      top: r.top.map((f) => aPublico(f, req.user.id)),
      me: r.yo ? aPublico(r.yo, req.user.id) : null,
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
    {
      id: "punteria",
      icon: "🎯",
      name: "Buena puntería",
      desc: "80 % de aciertos en Ludo (mínimo 10 respuestas).",
      unlocked: respuestas >= 10 && precision >= 0.8,
    },
    {
      id: "crucigramista",
      icon: "🔤",
      name: "Crucigramista",
      desc: "Resuelve 5 palabras o más en un crucigrama.",
      unlocked: cwBest >= 5,
    },
    {
      id: "todoterreno",
      icon: "🧩",
      name: "Todoterreno",
      desc: "Juega Ludo y Crucigrama.",
      unlocked: jugoLudo && jugoCw,
    },
  ];
}

// ----------------------------- perfil -----------------------------
profileRouter.get("/", async (req, res) => {
  try {
    // SELECT * (vía findUserById): publicUser necesita totp_enabled, email_verified_at y
    // password_hash para calcular sus banderas; con solo 5 columnas salían siempre falsas.
    const u = await findUserById(req.user.id);
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
           ) x`,
        )
        .get(u.id, u.id);
      return res.json({ ...base, docente: { ludoGames: l.c, crosswordGames: c.c, questions: q.c, students: e.c } });
    }

    const ludo = await db
      .prepare(
        `SELECT g.winner_team = p.team AS won, t.correct, t.incorrect
           FROM players p JOIN games g ON g.id = p.game_id
           JOIN teams t ON t.game_id = g.id AND t.color = p.team
          WHERE p.user_id = ? AND g.phase = 'finished'`,
      )
      .all(u.id);
    const cw = await db
      .prepare(
        `SELECT (g.winner_player_id = p.id) AS won, p.solved_count
           FROM crossword_players p JOIN crossword_games g ON g.id = p.game_id
          WHERE p.user_id = ? AND g.status = 'ended'`,
      )
      .all(u.id);

    const played = ludo.length + cw.length;
    const won = ludo.filter((g) => g.won).length + cw.filter((g) => g.won).length;
    const correct = ludo.reduce((a, g) => a + g.correct, 0);
    const incorrect = ludo.reduce((a, g) => a + g.incorrect, 0);
    const cwBest = cw.reduce((m, g) => Math.max(m, g.solved_count), 0);
    const r = await ranking(u.id, 0); // solo hace falta la fila propia y el total

    res.json({
      ...base,
      estudiante: {
        played,
        won,
        correct,
        incorrect,
        points: won * PUNTOS_VICTORIA + played * PUNTOS_PARTIDA,
        rank: r.yo ? r.yo.position : null,
        totalRanked: r.total,
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
  const nombre = String(req.body?.name || "")
    .trim()
    .replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 40)
    return res.status(400).json({ error: "Escribe tu nombre (entre 2 y 40 letras)." });
  try {
    await db.prepare("UPDATE users SET name = ? WHERE id = ?").run(nombre, req.user.id);
    res.json({ user: publicUser({ ...req.user, name: nombre }) });
  } catch (e) {
    console.error("Error al cambiar nombre:", e.message);
    res.status(500).json({ error: "No se pudo guardar el nombre." });
  }
});

// ----------------------------- cambiar / crear contraseña -----------------------------
// - Cuenta con contraseña: se pide la actual.
// - Cuenta creada con Google (aún sin contraseña): NO se crea aquí; se manda un enlace al correo
//   (POST /api/auth/password-link) para que solo la cree quien controla ese correo.
const intentos = new Map(); // userId -> { n, inicio }: 5 intentos fallidos cada 10 minutos
setInterval(
  () => {
    const limite = Date.now() - 10 * 60 * 1000;
    for (const [k, v] of intentos) if (v.inicio < limite) intentos.delete(k);
  },
  10 * 60 * 1000,
).unref();
profileRouter.post("/password", async (req, res) => {
  const actual = String(req.body?.currentPassword || "");
  const nueva = String(req.body?.newPassword || "");
  const ahora = Date.now();
  const a = intentos.get(req.user.id);
  const fallar = () => {
    const previo = a && ahora - a.inicio < 10 * 60 * 1000 ? a : { n: 0, inicio: ahora };
    intentos.set(req.user.id, { n: previo.n + 1, inicio: previo.inicio });
  };
  if (a && ahora - a.inicio < 10 * 60 * 1000 && a.n >= 5) {
    return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo otra vez." });
  }
  const errClave = validatePassword(nueva, req.user.email);
  if (errClave) return res.status(400).json({ error: errClave });
  try {
    const u = await db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
    if (u.password_hash === "google") {
      // Crear la primera contraseña va por enlace al correo (POST /api/auth/password-link).
      return res
        .status(400)
        .json({ error: "Tu cuenta entra con Google: pide el enlace a tu correo para crear una contraseña." });
    } else if (!(await verifyPassword(actual, u.password_hash))) {
      fallar();
      return res.status(401).json({ error: "La contraseña actual no es correcta." });
    }
    // token_version + 1 cierra las demás sesiones abiertas; a esta se le entrega un token nuevo para que no se salga.
    await db
      .prepare("UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?")
      .run(await hashPassword(nueva), req.user.id);
    intentos.delete(req.user.id);
    const fresco = await findUserById(req.user.id);
    res.json({ ok: true, token: signToken(fresco), user: publicUser(fresco) });
  } catch (e) {
    console.error("Error al cambiar contraseña:", e.message);
    res.status(500).json({ error: "No se pudo cambiar la contraseña." });
  }
});
