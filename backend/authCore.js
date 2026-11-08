// ============================================================================
// NÚCLEO DE AUTENTICACIÓN (sin Express, solo módulos de Node)
// ============================================================================
// - Contraseñas: se guardan con scrypt + sal aleatoria (nunca en texto plano).
// - Sesión: un token firmado con HMAC-SHA256 que caduca a los 30 días.
//   La clave de firma sale de AUTH_SECRET (variable de entorno) o, si no
//   existe, se genera sola una vez y se guarda en la base de datos.
// ============================================================================
import crypto from "node:crypto";
import db from "./db.js";

export const ROLES = ["docente", "estudiante"];
const TOKEN_DAYS = 30;

async function getSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'auth_secret'").get();
  if (row) return row.value;
  const nuevo = crypto.randomBytes(32).toString("hex");
  await db.prepare("INSERT INTO settings (key, value) VALUES ('auth_secret', ?) ON CONFLICT (key) DO NOTHING").run(nuevo);
  // Si dos servidores arrancaron a la vez, nos quedamos con el valor que haya quedado guardado.
  return (await db.prepare("SELECT value FROM settings WHERE key = 'auth_secret'").get()).value;
}
const SECRET = await getSecret();

// ---------------------------- contraseñas ----------------------------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored || "").split("$");
  if (alg !== "scrypt" || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const obtenido = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), esperado.length);
  return obtenido.length === esperado.length && crypto.timingSafeEqual(obtenido, esperado);
}

// ------------------------------ sesión ------------------------------
function firmar(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function signToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, exp: Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000 })
  ).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

// Devuelve el usuario dueño del token, o null si es inválido/caducado.
export async function userFromToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, firma] = token.split(".");
  if (!payload || !firma) return null;
  const a = Buffer.from(firma);
  const b = Buffer.from(firmar(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let datos;
  try {
    datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!datos.exp || datos.exp < Date.now()) return null;
  return await findUserById(datos.sub); // se lee de la BD: si borran la cuenta, la sesión deja de servir
}

// ------------------------------ usuarios ------------------------------
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
export const findUserById = async (id) => (await db.prepare("SELECT * FROM users WHERE id = ?").get(id)) || null;
export const findUserByEmail = async (email) =>
  (await db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).trim().toLowerCase())) || null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Devuelve { error } con un mensaje en español, o { data } con los datos limpios.
export function validateRegistration({ name, email, password, role }) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");
  if (n.length < 2 || n.length > 40) return { error: "Escribe tu nombre (entre 2 y 40 letras)." };
  if (!EMAIL_RE.test(e) || e.length > 120) return { error: "Escribe un correo válido." };
  if (p.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
  if (p.length > 100) return { error: "La contraseña es demasiado larga." };
  if (!ROLES.includes(role)) return { error: "Elige si eres docente o estudiante." };
  return { data: { name: n, email: e, password: p, role } };
}

export async function createUser({ name, email, password, role }) {
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)").run(
    id,
    name,
    email,
    hashPassword(password),
    role
  );
  return await findUserById(id);
}
