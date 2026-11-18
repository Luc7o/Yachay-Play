// ============================================================================
// NÚCLEO DE AUTENTICACIÓN (sin Express, solo módulos de Node)
// ============================================================================
// - Contraseñas: se guardan con scrypt + sal aleatoria (nunca en texto plano).
// - Sesión: un token firmado con HMAC-SHA256 que caduca a los 30 días.
//   Lleva la "versión" de sesión del usuario (users.token_version): al cambiar o
//   restablecer la contraseña esa versión sube y todas las sesiones viejas dejan de servir.
// - Token de desafío 2FA: token corto (5 min) que solo sirve para el 2.º paso del login.
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
export const getAuthSecret = () => SECRET; // lo usa twoFactor.js para cifrar el secreto 2FA

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
    JSON.stringify({ sub: user.id, v: user.token_version || 0, exp: Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000 })
  ).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

// Token de un solo propósito y vida corta (por ejemplo "2fa": paso intermedio del login).
// NO sirve como sesión: userFromToken lo rechaza porque lleva el campo "p".
export function signPurposeToken(purpose, sub, ttlMs) {
  const payload = Buffer.from(JSON.stringify({ p: purpose, sub, exp: Date.now() + ttlMs })).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

// Devuelve el "sub" si la firma es válida, no caducó y el propósito coincide; si no, null.
export function readPurposeToken(purpose, token) {
  const datos = leerToken(token);
  if (!datos || datos.p !== purpose) return null;
  return datos.sub;
}

function leerToken(token) {
  if (!token || typeof token !== "string" || token.length > 2048) return null;
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
  if (!datos || !datos.exp || datos.exp < Date.now()) return null;
  return datos;
}

// Devuelve el usuario dueño del token de sesión, o null si es inválido/caducado/revocado.
export async function userFromToken(token) {
  const datos = leerToken(token);
  if (!datos || datos.p) return null; // los tokens de propósito (2FA...) no son sesiones
  const user = await findUserById(datos.sub); // se lee de la BD: si borran la cuenta, la sesión deja de servir
  if (!user) return null;
  if ((datos.v || 0) !== (user.token_version || 0)) return null; // sesión revocada (cambio/restablecimiento de contraseña)
  return user;
}

// ------------------------------ usuarios ------------------------------
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, twoFactorEnabled: !!u.totp_enabled, hasPassword: u.password_hash !== "google" });
export const findUserById = async (id) => (await db.prepare("SELECT * FROM users WHERE id = ?").get(id)) || null;
export const findUserByEmail = async (email) =>
  (await db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).trim().toLowerCase())) || null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Regla de contraseña (registro, recuperar y cambiar): 8+ caracteres, con al menos una letra y un número.
export function validatePassword(p) {
  const v = String(p || "");
  if (v.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (v.length > 100) return "La contraseña es demasiado larga.";
  if (!/[A-Za-z\u00C0-\u017F]/.test(v) || !/\d/.test(v)) return "La contraseña debe incluir al menos una letra y un número.";
  return null;
}

// Devuelve { error } con un mensaje en español, o { data } con los datos limpios.
export function validateRegistration({ name, email, password, role, acceptTerms }) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");
  if (n.length < 2 || n.length > 40) return { error: "Escribe tu nombre (entre 2 y 40 letras)." };
  if (!EMAIL_RE.test(e) || e.length > 120) return { error: "Escribe un correo válido." };
  const errClave = validatePassword(p);
  if (errClave) return { error: errClave };
  if (!ROLES.includes(role)) return { error: "Elige si eres docente o estudiante." };
  if (acceptTerms !== true) return { error: "Debes aceptar los Términos y Condiciones y la Política de Privacidad." };
  return { data: { name: n, email: e, password: p, role, termsAccepted: true } };
}

export async function createUser({ name, email, password, role, termsAccepted = false }) {
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO users (id, name, email, password_hash, role, terms_accepted_at) VALUES (?,?,?,?,?, CASE WHEN ? THEN now() END)").run(
    id,
    name,
    email,
    hashPassword(password),
    role,
    termsAccepted
  );
  return await findUserById(id);
}

// ------------------------------ Google ------------------------------
// Verifica el "ID token" que entrega el botón "Continuar con Google" y devuelve
// { email, name } si es válido. Usa el endpoint oficial de Google (sin dependencias extra).
export async function verifyGoogleToken(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return { error: "El inicio de sesión con Google no está configurado en el servidor." };
  if (!credential || typeof credential !== "string" || credential.length > 4096) return { error: "Credencial de Google no válida." };
  let info;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) return { error: "Google no pudo validar tu sesión. Inténtalo de nuevo." };
    info = await r.json();
  } catch {
    return { error: "No se pudo contactar con Google. Inténtalo de nuevo." };
  }
  const issOk = info.iss === "https://accounts.google.com" || info.iss === "accounts.google.com";
  const verified = info.email_verified === true || info.email_verified === "true";
  if (info.aud !== clientId || !issOk || !verified || !info.email || Number(info.exp) * 1000 < Date.now()) {
    return { error: "No se pudo verificar tu cuenta de Google." };
  }
  const email = String(info.email).trim().toLowerCase();
  const name = String(info.name || email.split("@")[0]).trim().replace(/\s+/g, " ").slice(0, 40);
  return { email, name: name.length >= 2 ? name : email.split("@")[0].slice(0, 40) };
}

// Cuenta creada con Google: no tiene contraseña propia ("google" nunca coincide con un hash scrypt,
// así que no se puede entrar con contraseña hasta que la persona cree una desde su perfil).
export async function createGoogleUser({ name, email, role, termsAccepted = false }) {
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO users (id, name, email, password_hash, role, terms_accepted_at) VALUES (?,?,?,?,?, CASE WHEN ? THEN now() END)").run(id, name, email, "google", role, termsAccepted);
  return await findUserById(id);
}
