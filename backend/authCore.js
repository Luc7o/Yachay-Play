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
// Se guardan con scrypt (función de hash lenta, resistente a GPU) y una sal aleatoria por usuario.
// Formato:  scrypt$N$r$p$sal$hash   (los parámetros viajan con el hash, así se pueden subir más adelante).
// Formato antiguo (3 partes, N=16384): se sigue aceptando y se re-guarda con los parámetros nuevos
// la próxima vez que la persona inicie sesión (ver needsRehash).
// Es ASÍNCRONO: scryptSync bloqueaba todo el servidor (Socket.IO incluido) en cada login.
const SCRYPT = { N: 2 ** 15, r: 8, p: 3 }; // ~32 MB por cálculo (valores recomendados por OWASP)
const LEGACY = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;
const scryptAsync = (password, salt, len, o) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, len, { N: o.N, r: o.r, p: o.p, maxmem: 256 * o.N * o.r }, (e, k) => (e ? reject(e) : resolve(k)))
  );

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(String(password), salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function leerHash(stored) {
  const t = String(stored || "").split("$");
  if (t[0] !== "scrypt") return null;
  if (t.length === 3) return { ...LEGACY, salt: t[1], hash: t[2] };
  if (t.length === 6) {
    const o = { N: Number(t[1]), r: Number(t[2]), p: Number(t[3]), salt: t[4], hash: t[5] };
    // Tope por si alguien manipulara la base: evita parámetros que agoten la memoria.
    if (!(o.N >= 2 ** 12 && o.N <= 2 ** 18 && o.r >= 1 && o.r <= 16 && o.p >= 1 && o.p <= 8)) return null;
    return o;
  }
  return null;
}

export async function verifyPassword(password, stored) {
  const h = leerHash(stored);
  if (!h || !h.salt || !h.hash) return false;
  const esperado = Buffer.from(h.hash, "hex");
  if (!esperado.length) return false;
  const obtenido = await scryptAsync(String(password), Buffer.from(h.salt, "hex"), esperado.length, h);
  return obtenido.length === esperado.length && crypto.timingSafeEqual(obtenido, esperado);
}

// true si el hash guardado usa parámetros más débiles que los actuales (conviene re-guardarlo).
export function needsRehash(stored) {
  const h = leerHash(stored);
  return !!h && (h.N < SCRYPT.N || h.r < SCRYPT.r || h.p < SCRYPT.p);
}

// Si la contraseña ya fue verificada y su hash es viejo, lo actualiza en silencio.
export async function upgradeHashIfNeeded(user, password) {
  if (!needsRehash(user.password_hash)) return;
  try {
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?").run(await hashPassword(password), user.id, user.password_hash);
  } catch (e) {
    console.error("No se pudo actualizar el hash:", e.message);
  }
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
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, twoFactorEnabled: !!u.totp_enabled, hasPassword: u.password_hash !== "google", emailVerified: !!u.email_verified_at });
export const findUserById = async (id) => (await db.prepare("SELECT * FROM users WHERE id = ?").get(id)) || null;
export const findUserByEmail = async (email) =>
  (await db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).trim().toLowerCase())) || null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Regla de contraseña (registro, recuperar y cambiar): 8+ caracteres, con al menos una letra y un número.
const COMUNES = new Set(
  ("12345678 123456789 1234567890 password password1 password123 contrasena contrasena1 contrasena123 qwerty123 qwertyui " +
    "abc12345 abcd1234 iloveyou1 admin123 admin1234 welcome1 welcome123 letmein123 11111111 00000000 12341234 87654321 " +
    "yachayplay yachayplay1 yachayplay123 docente123 estudiante123 colegio123 profesor123 peru1234 lima1234 123456abc " +
    "a1234567 asdf1234 zxcvbnm123 qazwsx123 1q2w3e4r 1qaz2wsx q1w2e3r4 passw0rd p4ssw0rd").split(" ")
);

export function validatePassword(p, email) {
  const v = String(p || "");
  if (v.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (v.length > 100) return "La contraseña es demasiado larga.";
  if (!/[A-Za-z\u00C0-\u017F]/.test(v) || !/\d/.test(v)) return "La contraseña debe incluir al menos una letra y un número.";
  if (COMUNES.has(v.toLowerCase())) return "Esa contraseña es demasiado común. Elige otra más difícil de adivinar.";
  if (email && v.toLowerCase() === String(email).trim().toLowerCase()) return "La contraseña no puede ser igual a tu correo.";
  return null;
}

// Devuelve { error } con un mensaje en español, o { data } con los datos limpios.
// Texto de la casilla de edad (el mismo que muestra el formulario). Coincide con los
// Términos y la Política de Privacidad: un menor puede usar YachayPlay con autorización
// de sus padres o tutores (la ley peruana la exige por debajo de los 14 años).
export const MSG_EDAD = "Confirma que tienes 14 años o más, o que cuentas con la autorización de tus padres o tutores.";

export function validateRegistration({ name, email, password, role, acceptTerms, confirmAge }) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  const e = String(email || "").trim().toLowerCase();
  const p = String(password || "");
  if (n.length < 2 || n.length > 40) return { error: "Escribe tu nombre (entre 2 y 40 letras)." };
  if (!EMAIL_RE.test(e) || e.length > 120) return { error: "Escribe un correo válido." };
  const errClave = validatePassword(p, e);
  if (errClave) return { error: errClave };
  if (!ROLES.includes(role)) return { error: "Elige si eres docente o estudiante." };
  if (acceptTerms !== true) return { error: "Debes aceptar los Términos y Condiciones y la Política de Privacidad." };
  if (confirmAge !== true) return { error: MSG_EDAD };
  return { data: { name: n, email: e, password: p, role, termsAccepted: true } };
}

export async function createUser({ name, email, password, role, termsAccepted = false, emailVerified = false }) {
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO users (id, name, email, password_hash, role, terms_accepted_at, email_verified_at) VALUES (?,?,?,?,?, CASE WHEN ? THEN now() END, CASE WHEN ? THEN now() END)").run(
    id,
    name,
    email,
    await hashPassword(password),
    role,
    termsAccepted,
    emailVerified
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
  // Google ya comprobó el correo, así que la cuenta nace verificada.
  await db.prepare("INSERT INTO users (id, name, email, password_hash, role, terms_accepted_at, email_verified_at) VALUES (?,?,?,?,?, CASE WHEN ? THEN now() END, now())").run(id, name, email, "google", role, termsAccepted);
  return await findUserById(id);
}