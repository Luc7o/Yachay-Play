// ============================================================================
// BASE DE DATOS: PostgreSQL en Supabase (antes: SQLite local con node:sqlite)
// ============================================================================
// Las tablas YA están creadas en Supabase (games, teams, players, questions,
// users, settings, turn_history). Aquí solo nos conectamos.
//
// Necesita la variable DATABASE_URL en backend/.env  (ver .env.example).
//
// Para no reescribir todo el proyecto, mantenemos la misma forma de uso:
//     await db.prepare("SELECT * FROM users WHERE id = ?").get(id)
// con dos diferencias: ahora hay que usar `await`, y los `?` se convierten
// solos en $1, $2... que es lo que usa Postgres.
// ============================================================================
import "./env.js";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error(
    "\n[ERROR] Falta DATABASE_URL en backend/.env\n" +
      "Cópiala desde Supabase: botón 'Connect' -> 'Session pooler'. Mira .env.example\n",
  );
  process.exit(1);
}

// COUNT(*) llega como bigint (texto) en Postgres; lo convertimos a número normal.
pg.types.setTypeParser(20, (v) => Number(v));

// TLS hacia la base de datos. Por defecto SE VERIFICA el certificado (Neon usa
// certificados públicos, así que funciona sin configurar nada). Sin verificar,
// alguien en medio de la red podría hacerse pasar por la base de datos.
//  - DB_SSL_CA: certificado raíz en PEM (p. ej. el de Supabase) para verificar contra él.
//  - DB_SSL_INSECURE=true: último recurso, cifra pero NO verifica (como antes).
function sslConfig() {
  if (/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)) return false;
  if (process.env.DB_SSL_CA) return { rejectUnauthorized: true, ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n") };
  if (process.env.DB_SSL_INSECURE === "true") {
    console.warn("[SEGURIDAD] DB_SSL_INSECURE=true: la conexión a la base de datos no verifica el certificado.");
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
  max: 10,
});
pool.on("error", (e) => console.error("Error en la conexión a la base de datos:", e.message));

const aPostgres = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

const db = {
  prepare(sql) {
    const text = aPostgres(sql);
    return {
      get: async (...params) => (await pool.query(text, params)).rows[0],
      all: async (...params) => (await pool.query(text, params)).rows,
      run: async (...params) => ({ changes: (await pool.query(text, params)).rowCount }),
    };
  },
  pool,
};

// Comprobación al arrancar: si la URL o la contraseña están mal, avisamos claro.
try {
  await pool.query("SELECT 1");
  console.log("Conectado a Supabase (PostgreSQL).");
} catch (e) {
  console.error("\n[ERROR] No se pudo conectar a Supabase:", e.message);
  console.error("Revisa DATABASE_URL en backend/.env (contraseña y que sea la cadena 'Session pooler').\n");
  process.exit(1);
}

export default db;
