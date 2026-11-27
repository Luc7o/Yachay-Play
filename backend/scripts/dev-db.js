// ============================================================================
// BASE DE DATOS DE DESARROLLO (sin instalar PostgreSQL)
// ============================================================================
// Levanta un PostgreSQL en memoria (PGlite) en el puerto 5433, aplica las
// migraciones y deja el servidor escuchando. Los datos se pierden al cerrarlo.
//
// Uso (desde backend/):
//   npm run dev:db            -> en otra terminal: npm run dev con
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres SEED_DEMO_USERS=true
//
// Opciones: DEV_DB_PORT (5433 por defecto).
// ============================================================================
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.DEV_DB_PORT || 5433);
const URL = `postgresql://postgres:postgres@localhost:${PORT}/postgres`;
const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 20 });
await server.start();
console.log(`Base de datos de desarrollo lista en ${URL}`);

// Migraciones con el mismo script de producción
await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ["migrate.js", "up"], {
    cwd: BACKEND,
    env: { ...process.env, DATABASE_URL: URL },
    stdio: "inherit",
  });
  p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`migrate terminó con código ${code}`))));
});

console.log("\nArranca el backend en otra terminal con:");
console.log(`  DATABASE_URL=${URL} SEED_DEMO_USERS=true AUTH_SECRET=dev-local-solo-pruebas NODE_ENV=development npm run dev`);
console.log("Ctrl+C para cerrar (los datos se borran).");

const cerrar = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", cerrar);
process.on("SIGTERM", cerrar);
