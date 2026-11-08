// ============================================================================
// GUARDADO DEL CRUCIGRAMA EN LA BASE DE DATOS (Supabase)
// ============================================================================
// El motor (engine.js) avisa con "ganchos" cuando pasa algo importante y este
// archivo lo guarda. Todo se hace "por detrás": si la base falla, la partida en
// vivo sigue funcionando y solo se escribe un aviso en la consola.
//
// Las escrituras de una misma partida se hacen EN ORDEN (una cola por sala),
// para que, por ejemplo, el jugador nunca se guarde antes que la partida.
//
// Al arrancar el servidor, restoreCrosswordRooms() recupera las partidas que no
// habían terminado y las deja en la sala de espera.
// ============================================================================
import db from "../db.js";
import { hooks, restoreRoom } from "./engine.js";

const colas = new Map(); // room.id -> última promesa pendiente

function encolar(room, descripcion, tarea) {
  const previa = colas.get(room.id) || Promise.resolve();
  const siguiente = previa
    .then(tarea)
    .catch((e) => console.error(`[crucigrama] no se pudo guardar (${descripcion}):`, e.message));
  colas.set(room.id, siguiente);
  // Limpieza: si ya no hay nada pendiente, quitamos la cola para no acumular memoria.
  siguiente.finally(() => {
    if (colas.get(room.id) === siguiente) colas.delete(room.id);
  });
}

hooks.onCreate = (room) =>
  encolar(room, "crear partida", () =>
    db
      .prepare("INSERT INTO crossword_games (id, code, name, minutes, owner_id, grid) VALUES (?,?,?,?,?,?::jsonb)")
      .run(room.id, room.code, room.name, room.minutes, room.ownerId || null, JSON.stringify(room.grid))
  );

hooks.onPlayer = (room, p) =>
  encolar(room, "nuevo jugador", () =>
    db
      .prepare("INSERT INTO crossword_players (game_id, id, user_id, name) VALUES (?,?,?,?) ON CONFLICT DO NOTHING")
      .run(room.id, p.id, p.userId || null, p.name)
  );

hooks.onStart = (room) =>
  encolar(room, "iniciar", () =>
    db.prepare("UPDATE crossword_games SET status = 'playing', started_at = now() WHERE id = ?").run(room.id)
  );

hooks.onClose = (room) =>
  encolar(room, "cerrar partida", async () => {
    await db
      .prepare(
        "UPDATE crossword_games SET status = 'ended', end_reason = ?, winner_player_id = ?, ended_at = now() WHERE id = ?"
      )
      .run(room.endReason, room.winnerId || null, room.id);

    const jugadores = [...room.players.values()];
    if (!jugadores.length) return;
    await db
      .prepare(
        `UPDATE crossword_players cp
            SET score = v.score, solved_count = v.solved, finish_rank = v.rank,
                finished_at = to_timestamp(v.fin / 1000.0)
           FROM (SELECT unnest(?::text[]) AS id, unnest(?::int[]) AS score, unnest(?::int[]) AS solved,
                        unnest(?::int[]) AS rank, unnest(?::float8[]) AS fin) v
          WHERE cp.game_id = ? AND cp.id = v.id`
      )
      .run(
        jugadores.map((p) => p.id),
        jugadores.map((p) => Math.round(p.score)),
        jugadores.map((p) => p.solved.size),
        jugadores.map((p) => p.finishRank ?? null),
        jugadores.map((p) => p.finishedAt ?? null),
        room.id
      );
  });

hooks.onReset = (room) =>
  encolar(room, "reiniciar", async () => {
    await db
      .prepare(
        "UPDATE crossword_games SET status = 'lobby', end_reason = NULL, winner_player_id = NULL, started_at = NULL, ended_at = NULL WHERE id = ?"
      )
      .run(room.id);
    await db
      .prepare("UPDATE crossword_players SET score = 0, solved_count = 0, finish_rank = NULL, finished_at = NULL WHERE game_id = ?")
      .run(room.id);
  });

// Recupera las partidas no terminadas. Se llama una vez al arrancar el servidor.
export async function restoreCrosswordRooms() {
  const partidas = await db.prepare("SELECT * FROM crossword_games WHERE status <> 'ended' AND created_at > now() - interval '12 hours'").all();
  const recuperadas = [];
  for (const g of partidas) {
    const jugadores = await db
      .prepare("SELECT id, name, user_id FROM crossword_players WHERE game_id = ? ORDER BY joined_at")
      .all(g.id);
    const room = restoreRoom({
      id: g.id,
      code: g.code,
      name: g.name,
      ownerId: g.owner_id,
      minutes: g.minutes,
      grid: g.grid, // jsonb: pg ya lo devuelve como objeto
      players: jugadores.map((p) => ({ id: p.id, name: p.name, userId: p.user_id })),
    });
    // Si estaba en juego, vuelve a la sala de espera con el marcador en cero.
    if (g.status === "playing") hooks.onReset?.(room);
    recuperadas.push(g.code);
  }
  if (recuperadas.length) console.log(`Crucigramas recuperados de la base de datos: ${recuperadas.join(", ")}`);
}
