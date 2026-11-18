// ============================================================================
// REGISTRO DE MIGRACIONES
// ============================================================================
// Uso (desde backend/):
//   npm run migrate              -> aplica las migraciones pendientes
//   npm run migrate:status       -> muestra qué está aplicada, pendiente o modificada
//   npm run migrate:new -- nombre_corto   -> crea migrations/NNNN_nombre_corto.sql
//
// Cómo funciona:
//   - Cada migración es un archivo .sql en backend/migrations/ con nombre NNNN_descripcion.sql
//     (NNNN = número correlativo; se aplican en orden).
//   - La tabla `schema_migrations` guarda el registro: versión, nombre, checksum (SHA-256 del
//     archivo), cuándo se aplicó y cuánto tardó.
//   - Cada migración corre dentro de una transacción: si falla, no queda a medias ni se registra.
//     (Si necesitas algo que no puede ir en transacción, como CREATE INDEX CONCURRENTLY,
//     pon `-- no-transaction` en la primera línea del archivo.)
//   - Si editas una migración que ya se aplicó, el checksum cambia y el script se detiene:
//     las migraciones aplicadas no se tocan, se crea una nueva.
//   - Un lock de Postgres evita que dos procesos migren a la vez.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const LOCK_ID = 727_001; // número arbitrario para pg_advisory_lock
const FILE_RE = /^(\d{4,})_([a-z0-9_]+)\.sql$/;

const checksum = (txt) => crypto.createHash("sha256").update(txt.replace(/\r\n/g, "\n")).digest("hex");

function leerArchivos() {
  if (!fs.existsSync(DIR)) return [];
  const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const vistas = new Set();
  return archivos.map((file) => {
    const m = file.match(FILE_RE);
    if (!m) throw new Error(`Nombre inválido: migrations/${file} (usa NNNN_descripcion_en_minusculas.sql)`);
    const version = Number(m[1]);
    if (vistas.has(version)) throw new Error(`Versión duplicada ${m[1]}: hay dos migraciones con el mismo número.`);
    vistas.add(version);
    const sql = fs.readFileSync(path.join(DIR, file), "utf8");
    return { version, name: m[2], file, sql, checksum: checksum(sql), transaccion: !/^\s*--\s*no-transaction/i.test(sql) };
  });
}

async function asegurarTabla(c) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version      integer PRIMARY KEY,
      name         text NOT NULL,
      checksum     text NOT NULL,
      applied_at   timestamptz NOT NULL DEFAULT now(),
      execution_ms integer NOT NULL DEFAULT 0
    )`);
}

async function estado(c) {
  const archivos = leerArchivos();
  const aplicadas = new Map((await c.query("SELECT * FROM schema_migrations ORDER BY version")).rows.map((r) => [r.version, r]));
  const filas = archivos.map((a) => {
    const r = aplicadas.get(a.version);
    const st = !r ? "pendiente" : r.checksum !== a.checksum ? "MODIFICADA" : "aplicada";
    return { ...a, registro: r, estado: st };
  });
  const faltantes = [...aplicadas.values()].filter((r) => !archivos.some((a) => a.version === r.version));
  return { filas, faltantes };
}

async function status(c) {
  const { filas, faltantes } = await estado(c);
  if (!filas.length && !faltantes.length) return console.log("No hay migraciones.");
  for (const f of filas) {
    const cuando = f.registro ? `  (${new Date(f.registro.applied_at).toISOString().replace("T", " ").slice(0, 19)} UTC, ${f.registro.execution_ms} ms)` : "";
    console.log(`${String(f.version).padStart(4, "0")}  ${f.estado.padEnd(10)}  ${f.name}${cuando}`);
  }
  for (const r of faltantes) console.log(`${String(r.version).padStart(4, "0")}  SIN ARCHIVO  ${r.name}  (está registrada en la BD pero falta el archivo)`);
  const pend = filas.filter((f) => f.estado === "pendiente").length;
  console.log(`\n${filas.length - pend} aplicadas, ${pend} pendientes.`);
}

async function up(c) {
  const { filas, faltantes } = await estado(c);
  const modificadas = filas.filter((f) => f.estado === "MODIFICADA");
  if (modificadas.length) {
    throw new Error(
      "Estas migraciones ya aplicadas fueron modificadas: " + modificadas.map((f) => f.file).join(", ") +
        "\nNo edites migraciones aplicadas: revierte el archivo (git) y crea una nueva con `npm run migrate:new`."
    );
  }
  if (faltantes.length) console.warn("Aviso: en la BD hay migraciones sin archivo: " + faltantes.map((r) => r.version).join(", "));

  const pendientes = filas.filter((f) => f.estado === "pendiente");
  // Evita huecos: no aplicar una versión menor que la última ya aplicada (llegó tarde de otra rama).
  const ultima = Math.max(0, ...filas.filter((f) => f.registro).map((f) => f.version));
  const tarde = pendientes.filter((f) => f.version < ultima);
  if (tarde.length) throw new Error("Migraciones pendientes con número menor a la última aplicada: " + tarde.map((f) => f.file).join(", ") + "\nRenómbralas con un número mayor.");

  if (!pendientes.length) return console.log("Base de datos al día. No hay migraciones pendientes.");
  for (const m of pendientes) {
    const t0 = Date.now();
    process.stdout.write(`Aplicando ${m.file} ... `);
    try {
      if (m.transaccion) await c.query("BEGIN");
      await c.query(m.sql);
      const ms = Date.now() - t0;
      await c.query("INSERT INTO schema_migrations (version, name, checksum, execution_ms) VALUES ($1,$2,$3,$4)", [m.version, m.name, m.checksum, ms]);
      if (m.transaccion) await c.query("COMMIT");
      console.log(`ok (${ms} ms)`);
    } catch (e) {
      if (m.transaccion) await c.query("ROLLBACK").catch(() => {});
      console.log("ERROR");
      throw new Error(`Falló ${m.file}: ${e.message}${m.transaccion ? "\nSe hizo rollback; nada de esta migración quedó aplicado." : ""}`);
    }
  }
  console.log(`\nListo: ${pendientes.length} migración(es) aplicada(s).`);
}

function nueva(nombre) {
  const slug = (nombre || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!slug) throw new Error("Falta el nombre. Ej: npm run migrate:new -- agregar_avatar_a_users");
  fs.mkdirSync(DIR, { recursive: true });
  const max = Math.max(0, ...leerArchivos().map((f) => f.version));
  const file = `${String(max + 1).padStart(4, "0")}_${slug}.sql`;
  fs.writeFileSync(path.join(DIR, file), `-- ${file}\n-- Describe aquí qué cambia y por qué.\n\n`);
  console.log(`Creada migrations/${file}`);
}

const [cmd = "up", arg] = process.argv.slice(2);
let c, db;
let codigo = 0;
try {
  if (cmd === "new") {
    nueva(arg);
  } else if (cmd === "up" || cmd === "status") {
    ({ default: db } = await import("./db.js")); // se importa aquí para que `new` no necesite conexión
    c = await db.pool.connect();
    await c.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await asegurarTabla(c);
    await (cmd === "up" ? up(c) : status(c));
  } else {
    throw new Error(`Comando desconocido: ${cmd}. Usa up, status o new.`);
  }
} catch (e) {
  console.error("\n[ERROR] " + e.message);
  codigo = 1;
} finally {
  if (c) {
    await c.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    c.release();
  }
  if (db) await db.pool.end();
}
process.exit(codigo);
