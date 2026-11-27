// ============================================================================
// ENTORNO PARA PRUEBAS DE INTEGRACIÓN
// ============================================================================
// Levanta un PostgreSQL en memoria (PGlite), aplica las migraciones reales y
// arranca server.js contra esa base en un puerto libre. Las pruebas hablan con
// la API por HTTP, igual que el frontend. Los correos (sin RESEND_API_KEY) se
// imprimen en la consola del servidor: `correos()` los devuelve para leer los
// enlaces de verificación y de recuperación.
// ============================================================================
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function puertoLibre() {
  return new Promise((ok, mal) => {
    const s = net.createServer();
    s.unref();
    s.on("error", mal);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

function correr(args, env) {
  return new Promise((ok, mal) => {
    const p = spawn(process.execPath, args, { cwd: BACKEND, env, stdio: "pipe" });
    let salida = "";
    p.stdout.on("data", (d) => (salida += d));
    p.stderr.on("data", (d) => (salida += d));
    p.on("exit", (c) => (c === 0 ? ok() : mal(new Error(`${args.join(" ")} terminó con ${c}\n${salida}`))));
  });
}

export async function levantar() {
  const puertoDb = await puertoLibre();
  const puertoApi = await puertoLibre();
  const db = await PGlite.create();
  const servidorDb = new PGLiteSocketServer({ db, port: puertoDb, host: "127.0.0.1", maxConnections: 20 });
  await servidorDb.start();
  const env = {
    PATH: process.env.PATH,
    SYSTEMROOT: process.env.SYSTEMROOT, // Windows
    NODE_ENV: "development",
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${puertoDb}/postgres`,
    AUTH_SECRET: "solo-pruebas-de-integracion-0123456789",
    SEED_DEMO_USERS: "true",
    TRUST_PROXY: "1", // cada petición trae su propia IP (X-Forwarded-For) para no chocar con los límites por IP
    PORT: String(puertoApi),
    CORS_ORIGIN: "http://localhost:5173",
  };
  await correr(["migrate.js", "up"], env);

  const api = spawn(process.execPath, ["server.js"], { cwd: BACKEND, env, stdio: "pipe" });
  let consola = "";
  api.stdout.on("data", (d) => (consola += d));
  api.stderr.on("data", (d) => (consola += d));
  await new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error("El servidor no arrancó:\n" + consola)), 30_000);
    const mirar = () => {
      if (/escuchando en puerto/.test(consola)) {
        clearTimeout(t);
        ok();
      }
    };
    api.stdout.on("data", mirar);
    api.on("exit", (c) => mal(new Error(`server.js terminó con ${c}:\n${consola}`)));
  });

  const base = `http://127.0.0.1:${puertoApi}`;
  /** Llama a la API: pedir("POST", "/api/auth/login", { body, token }) -> { status, body } */
  let ip = 0;
  async function pedir(metodo, ruta, { body, token } = {}) {
    ip++;
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-Forwarded-For": `10.${(ip >> 16) & 255}.${(ip >> 8) & 255}.${ip & 255}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const texto = await r.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {}
    return { status: r.status, body: json ?? texto };
  }

  /** Espera (hasta 5 s) un correo para `para` que contenga `marca`, y devuelve el token del enlace. */
  async function tokenDelCorreo(para, marca) {
    const re = new RegExp(`Correo para ${para.replace(/[.+]/g, "\\$&")}[\\s\\S]*?#/${marca}/([A-Za-z0-9_-]+)`, "g");
    for (let i = 0; i < 50; i++) {
      const todos = [...consola.matchAll(re)];
      if (todos.length) return todos.at(-1)[1];
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`No llegó el correo "${marca}" para ${para}`);
  }

  async function cerrar() {
    api.removeAllListeners("exit");
    api.kill();
    await servidorDb.stop();
    await db.close();
  }

  return { pedir, tokenDelCorreo, cerrar };
}
