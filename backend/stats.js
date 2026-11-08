// ============================================================================
// ESTADÍSTICAS  (GET /api/stats)
// ============================================================================
// - Docente: resumen de SUS partidas (Ludo y Crucigrama), quién ganó, y qué
//   preguntas se fallan más.
// - Estudiante: su historial personal (solo partidas donde jugó con su cuenta).
// ============================================================================
import { Router } from "express";
import db from "./db.js";

export const statsRouter = Router();

statsRouter.get("/", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Inicia sesión para ver tus estadísticas." });
  const uid = req.user.id;
  try {
    if (req.user.role === "docente") return res.json(await statsDocente(uid));
    return res.json(await statsEstudiante(uid));
  } catch (e) {
    console.error("Error en estadísticas:", e.message);
    res.status(500).json({ error: "No se pudieron cargar las estadísticas." });
  }
});

async function statsDocente(uid) {
  const ludoTot = await db
    .prepare(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE phase = 'finished')::int AS finished
         FROM games WHERE owner_id = ?`
    )
    .get(uid);
  const ludoPlayers = await db
    .prepare("SELECT COUNT(*)::int AS c FROM players p JOIN games g ON g.id = p.game_id WHERE g.owner_id = ?")
    .get(uid);
  const wins = await db
    .prepare("SELECT winner_team, COUNT(*)::int AS c FROM games WHERE owner_id = ? AND winner_team IS NOT NULL GROUP BY winner_team")
    .all(uid);
  const ludoRecent = await db
    .prepare(
      `SELECT g.code, g.name, g.phase, g.winner_team, g.end_reason, g.created_at,
              (SELECT COUNT(*)::int FROM players p WHERE p.game_id = g.id) AS players
         FROM games g WHERE g.owner_id = ? ORDER BY g.created_at DESC LIMIT 8`
    )
    .all(uid);
  const hard = await db
    .prepare(
      `SELECT q.id, q.topic, q.question, COUNT(*)::int AS asked, COALESCE(SUM(t.correct), 0)::int AS correct
         FROM turn_history t
         JOIN games g ON g.id = t.game_id
         JOIN questions q ON q.id = t.question_id
        WHERE g.owner_id = ?
        GROUP BY q.id
       HAVING COUNT(*) >= 2
        ORDER BY (SUM(t.correct)::float / COUNT(*)) ASC, COUNT(*) DESC
        LIMIT 5`
    )
    .all(uid);

  const cwTot = await db
    .prepare(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'ended')::int AS finished
         FROM crossword_games WHERE owner_id = ?`
    )
    .get(uid);
  const cwPlayers = await db
    .prepare("SELECT COUNT(*)::int AS c FROM crossword_players p JOIN crossword_games g ON g.id = p.game_id WHERE g.owner_id = ?")
    .get(uid);
  const cwRecent = await db
    .prepare(
      `SELECT g.code, g.name, g.status, g.end_reason, g.created_at,
              (SELECT COUNT(*)::int FROM crossword_players p WHERE p.game_id = g.id) AS players,
              (SELECT p.name FROM crossword_players p WHERE p.game_id = g.id AND p.id = g.winner_player_id) AS winner
         FROM crossword_games g WHERE g.owner_id = ? ORDER BY g.created_at DESC LIMIT 8`
    )
    .all(uid);
  const cwTop = await db
    .prepare(
      `SELECT p.name, MAX(p.score)::int AS best, COUNT(*)::int AS games
         FROM crossword_players p JOIN crossword_games g ON g.id = p.game_id
        WHERE g.owner_id = ?
        GROUP BY p.name ORDER BY best DESC LIMIT 5`
    )
    .all(uid);

  return {
    role: "docente",
    ludo: {
      total: ludoTot.total,
      finished: ludoTot.finished,
      players: ludoPlayers.c,
      winsByColor: Object.fromEntries(wins.map((w) => [w.winner_team, w.c])),
      recent: ludoRecent,
      hardQuestions: hard.map((h) => ({ ...h, pct: Math.round((h.correct / h.asked) * 100) })),
    },
    crossword: {
      total: cwTot.total,
      finished: cwTot.finished,
      players: cwPlayers.c,
      recent: cwRecent,
      top: cwTop,
    },
  };
}

async function statsEstudiante(uid) {
  const ludo = await db
    .prepare(
      `SELECT g.code, g.name, g.phase, g.winner_team, g.created_at,
              p.team, p.name AS player_name, t.score, t.correct, t.incorrect
         FROM players p
         JOIN games g ON g.id = p.game_id
         JOIN teams t ON t.game_id = g.id AND t.color = p.team
        WHERE p.user_id = ?
        ORDER BY g.created_at DESC LIMIT 30`
    )
    .all(uid);
  const cw = await db
    .prepare(
      `SELECT g.code, g.name, g.status, g.created_at, p.score, p.solved_count, p.finish_rank,
              (g.winner_player_id = p.id) AS won
         FROM crossword_players p JOIN crossword_games g ON g.id = p.game_id
        WHERE p.user_id = ?
        ORDER BY g.created_at DESC LIMIT 30`
    )
    .all(uid);

  const ludoGanadas = ludo.filter((g) => g.phase === "finished" && g.winner_team === g.team).length;
  const cwGanadas = cw.filter((g) => g.won).length;
  return {
    role: "estudiante",
    summary: {
      played: ludo.length + cw.length,
      won: ludoGanadas + cwGanadas,
      correct: ludo.reduce((a, g) => a + g.correct, 0),
      incorrect: ludo.reduce((a, g) => a + g.incorrect, 0),
    },
    ludo,
    crossword: cw,
  };
}
