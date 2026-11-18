// ============================================================================
// GUARDADO DE "PRESENTACIONES EN VIVO" EN LA BASE DE DATOS
// ============================================================================
// - La tabla se crea sola al arrancar (CREATE TABLE IF NOT EXISTS): no hay que
//   ejecutar nada a mano. (También está copiada en schema.sql, como referencia.)
// - Las salas viven en memoria; cada 4 segundos se guardan las que cambiaron.
// - Si la base falla, la clase en vivo sigue funcionando y solo se avisa en consola.
// - Al arrancar el servidor se recuperan las salas de las últimas 24 horas.
// ============================================================================
import db from "../db.js";
import { hooks, rooms, restaurar, serializar } from "./engine.js";

let guardando = false; // true mientras el guardado automático está escribiendo en la base

// Borra una sala de la base. Espera a que termine un guardado en curso para que no la vuelva a escribir.
// Si la tabla aún no existe (la base no estaba lista), no hay nada que borrar.
export async function borrarSala(id) {
  while (guardando) await new Promise((r) => setTimeout(r, 60));
  try {
    await db.pool.query("DELETE FROM slide_rooms WHERE id = $1", [id]);
  } catch (e) {
    if (e.code !== "42P01") throw e;
  }
}

export async function startSlidesPersistence() {
  try {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS slide_rooms (
        id         text PRIMARY KEY,
        code       text NOT NULL,
        owner_id   text REFERENCES users(id) ON DELETE SET NULL,
        status     text NOT NULL DEFAULT 'open',
        data       jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await db.pool.query("CREATE INDEX IF NOT EXISTS slide_rooms_owner_idx ON slide_rooms(owner_id)");

    const { rows } = await db.pool.query("SELECT data FROM slide_rooms WHERE updated_at > now() - interval '24 hours'");
    let n = 0;
    for (const r of rows) if (restaurar(r.data)) n++;
    if (n) console.log(`[presentaciones] ${n} sala(s) recuperada(s).`);
  } catch (e) {
    console.error("[presentaciones] no se pudo preparar la base (la herramienta funciona, pero no se guardará):", e.message);
    return;
  }

  hooks.onDirty = () => {}; // la bandera room.dirty la pone el motor; aquí solo se guarda por tiempo
  setInterval(async () => {
    if (guardando) return;
    guardando = true;
    try {
      for (const room of rooms.values()) {
        if (!room.dirty || room.deleted) continue;
        room.dirty = false;
        try {
          await db.pool.query(
            `INSERT INTO slide_rooms (id, code, owner_id, status, data, updated_at)
             VALUES ($1,$2,$3,$4,$5::jsonb, now())
             ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, data = EXCLUDED.data, updated_at = now()`,
            [room.id, room.code, room.ownerId, room.status, JSON.stringify(serializar(room))]
          );
        } catch (e) {
          room.dirty = true; // reintenta en el próximo ciclo
          console.error("[presentaciones] no se pudo guardar la sala", room.code, e.message);
        }
      }
    } finally {
      guardando = false;
    }
  }, 4000).unref?.();
}
