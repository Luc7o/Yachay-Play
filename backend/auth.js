// Rutas y middlewares de autenticación para Express.
//
//   POST /api/auth/register        crear cuenta (exige aceptar Términos y Privacidad)
//   POST /api/auth/login           correo + contraseña  (si tiene 2FA responde { needs2FA, challenge })
//   POST /api/auth/login/2fa       2.º paso: { challenge, code }  (código de la app o de recuperación)
//   POST /api/auth/google          entrar / crear cuenta con Google (también pasa por el 2FA si está activo)
//   POST /api/auth/password-link   (con sesión, cuenta de Google) enlace al correo para crear contraseña
//   POST /api/auth/forgot          pedir enlace para restablecer contraseña (responde siempre igual)
//   POST /api/auth/reset           { token, password } -> nueva contraseña (cierra las demás sesiones)
//   POST /api/auth/verify-email    { token } -> confirma el correo (enlace que llega al registrarse)
//   POST /api/auth/resend-verification  (con sesión) reenvía el enlace de verificación
//   POST /api/auth/logout-all      (con sesión) cierra la sesión en todos los dispositivos
//   GET  /api/auth/me              validar la sesión guardada
//   POST /api/auth/2fa/setup       (con sesión) genera secreto + QR
//   POST /api/auth/2fa/enable      (con sesión) { code } activa el 2FA y entrega 8 códigos de recuperación
//   POST /api/auth/2fa/disable     (con sesión) { code, password? } desactiva el 2FA
//   POST /api/auth/2fa/recovery-codes  (con sesión) { code } genera códigos de recuperación nuevos
import crypto from "node:crypto";
import { Router } from "express";
import db from "./db.js";
import {
  createGoogleUser,
  createUser,
  findUserByEmail,
  findUserById,
  hashPassword,
  publicUser,
  readPurposeToken,
  signPurposeToken,
  signToken,
  upgradeHashIfNeeded,
  userFromToken,
  validatePassword,
  validateRegistration,
  verifyGoogleToken,
  verifyPassword,
  ROLES,
} from "./authCore.js";
import { DEMO_USERS, demoEnabled } from "./seed.js";
import { codigosRestantes, crearCodigosRecuperacion, cifrar, descifrar, nuevoSecreto, qrComoImagen, urlOtpauth, verificarSegundoPaso, verificarTotp } from "./twoFactor.js";
import { enviarAvisoCambioClave, enviarRecuperacion, enviarVerificacion } from "./mailer.js";

export const authRouter = Router();

// Las respuestas de autenticación llevan tokens y datos personales: que nadie las guarde en caché.
authRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// --- Freno contra fuerza bruta: `max` intentos por ventana, por clave (IP, correo, usuario...) ---
function crearLimite(max, ventanaMs) {
  const mapa = new Map();
  setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of mapa) if (ahora - v.inicio > ventanaMs) mapa.delete(k);
  }, 60_000).unref();
  return {
    // true si esta petición ya superó el límite
    excedido(clave) {
      const ahora = Date.now();
      const a = mapa.get(clave);
      if (!a || ahora - a.inicio > ventanaMs) {
        mapa.set(clave, { n: 1, inicio: ahora });
        return false;
      }
      a.n += 1;
      return a.n > max;
    },
    // Solo consulta si ya se llegó al tope, sin sumar un intento.
    lleno: (clave) => {
      const a = mapa.get(clave);
      return !!a && Date.now() - a.inicio <= ventanaMs && a.n >= max;
    },
    reiniciar: (clave) => mapa.delete(clave),
  };
}
const MIN = 60 * 1000;
const limLogin = crearLimite(10, 10 * MIN); // por IP + correo
const limLoginCorreo = crearLimite(30, 15 * MIN); // por correo (frena ataques repartidos entre muchas IP)
const limVerif = crearLimite(3, 60 * MIN); // reenvíos del correo de verificación, por usuario
const limGoogle = crearLimite(20, 10 * MIN);
const limDosPasos = crearLimite(10, 10 * MIN); // por usuario
const limOlvide = crearLimite(3, 60 * MIN); // por correo
const limOlvideIp = crearLimite(10, 60 * MIN); // por IP
const limReset = crearLimite(10, 60 * MIN);
const limRegistro = crearLimite(10, 60 * MIN);
const MSG_LIMITE = "Demasiados intentos. Espera unos minutos e inténtalo otra vez.";

const DUMMY_HASH = await hashPassword("relleno-para-igualar-tiempos");
const sha256 = (t) => crypto.createHash("sha256").update(t).digest("hex");

// Evita que una excepción deje la petición colgada (Express 4 no captura errores async).
const ruta = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(`Error en ${req.method} ${req.originalUrl}:`, e.message);
    if (!res.headersSent) res.status(500).json({ error: "Ocurrió un problema en el servidor. Inténtalo de nuevo." });
  });
};

function requireSession(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Inicia sesión para continuar." });
  next();
}

// Entrega la sesión, o pide el 2.º paso si la cuenta tiene 2FA activo.
function responderSesion(res, user) {
  if (user.totp_enabled) {
    return res.json({ needs2FA: true, challenge: signPurposeToken("2fa", user.id, 5 * MIN) });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}

// ------------------------------ registro / login ------------------------------
authRouter.post("/register", ruta(async (req, res) => {
  if (limRegistro.excedido(`${req.ip}|reg`)) return res.status(429).json({ error: MSG_LIMITE });
  const { error, data } = validateRegistration(req.body || {});
  if (error) return res.status(400).json({ error });
  if (await findUserByEmail(data.email)) return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
  let user;
  try {
    user = await createUser(data);
  } catch (e) {
    // Dos registros simultáneos con el mismo correo: el segundo choca con el índice único.
    if (e.code === "23505") return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
    throw e;
  }
  enviarEnlaceVerificacion(user).catch((e) => console.error("No se pudo enviar la verificación:", e.message)); // sin await: no retrasa el registro
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

authRouter.post("/login", ruta(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (password.length > 200) return res.status(401).json({ error: "Correo o contraseña incorrectos." }); // evita gastar CPU con textos enormes
  // Por correo solo se MIRA el contador aquí (sin sumar): suma únicamente cuando la
  // contraseña falla. Así un intento correcto del dueño no gasta cupo, y quien solo
  // conoce el correo necesita 30 fallos reales para bloquearlo, no 30 peticiones cualesquiera.
  if (limLogin.excedido(`${req.ip}|${email}`) || limLoginCorreo.lleno(email)) return res.status(429).json({ error: MSG_LIMITE });
  const user = await findUserByEmail(email);
  // Siempre verificamos un hash (aunque el correo no exista) para no delatar qué correos están registrados.
  // Las cuentas solo-Google ("google") también pasan por scrypt, para no distinguirse por el tiempo de respuesta.
  const soloGoogle = user?.password_hash === "google";
  const ok = (await verifyPassword(password, user && !soloGoogle ? user.password_hash : DUMMY_HASH)) && !soloGoogle;
  if (!user || !ok) {
    limLoginCorreo.excedido(email); // cuenta el fallo
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }
  limLogin.reiniciar(`${req.ip}|${email}`);
  limLoginCorreo.reiniciar(email);
  await upgradeHashIfNeeded(user, password); // si el hash era de la versión anterior, se re-guarda con los parámetros nuevos
  responderSesion(res, user);
}));

// 2.º paso del login: { challenge, code }
authRouter.post("/login/2fa", ruta(async (req, res) => {
  const userId = readPurposeToken("2fa", req.body?.challenge);
  if (!userId) return res.status(401).json({ error: "La verificación caducó. Vuelve a iniciar sesión." });
  if (limDosPasos.excedido(userId)) return res.status(429).json({ error: MSG_LIMITE });
  const user = await findUserById(userId);
  if (!user || !user.totp_enabled) return res.status(401).json({ error: "La verificación caducó. Vuelve a iniciar sesión." });
  if (!(await verificarSegundoPaso(user, req.body?.code))) {
    return res.status(401).json({ error: "Código incorrecto. Revisa tu app de autenticación e inténtalo de nuevo." });
  }
  limDosPasos.reiniciar(userId);
  const fresco = await findUserById(userId);
  res.json({ token: signToken(fresco), user: publicUser(fresco), recoveryLeft: await codigosRestantes(userId) });
}));

// Iniciar sesión / crear cuenta con Google. Body: { credential, role?, acceptTerms? }
// - Si el correo ya tiene cuenta, entra (con 2FA si lo tiene activo).
// - Si no tiene y falta el rol o aceptar los términos, responde { needsRole: true } para que el frontend lo pida.
authRouter.post("/google", ruta(async (req, res) => {
  if (limGoogle.excedido(`${req.ip}|google`)) return res.status(429).json({ error: MSG_LIMITE });
  const g = await verifyGoogleToken(req.body?.credential);
  if (g.error) return res.status(401).json({ error: g.error });
  let user = await findUserByEmail(g.email);
  if (!user) {
    const role = req.body?.role;
    if (!ROLES.includes(role) || req.body?.acceptTerms !== true) return res.json({ needsRole: true, email: g.email, name: g.name });
    user = await createGoogleUser({ name: g.name, email: g.email, role, termsAccepted: true });
  } else if (!user.email_verified_at) {
    // Hay una cuenta con contraseña cuyo correo NUNCA se verificó. Alguien pudo haberla creado con el correo ajeno
    // y quedarse con la contraseña. Como Google acaba de demostrar que este correo es de quien entra, la cuenta pasa
    // a ser suya: se borran la contraseña, el 2FA y las sesiones anteriores (puede crear una contraseña nueva desde
    // su perfil o con «¿Olvidaste tu contraseña?»).
    await tomarCuentaSinVerificar(user.id);
    user = await findUserById(user.id);
  }
  responderSesion(res, user);
}));

// Sirve para comprobar que la sesión guardada en el navegador sigue siendo válida.
authRouter.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sesión no válida" });
  res.json({ user: publicUser(req.user) });
});

// Cuentas de prueba para el acceso rápido del login. Solo se ofrecen fuera de producción.
authRouter.get("/demo", (_req, res) => {
  if (!demoEnabled() || process.env.NODE_ENV === "production") return res.json({ accounts: [] });
  res.json({ accounts: DEMO_USERS.map(({ name, email, password, role }) => ({ name, email, password, role })) });
});

// ------------------------------ recuperar contraseña ------------------------------
// Siempre responde lo mismo, exista o no el correo (así no se puede averiguar quién tiene cuenta).
// Genera un enlace de un solo uso (30 min) para poner contraseña y lo manda al correo.
async function mandarEnlaceClave(user, { crear = false } = {}) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.prepare("UPDATE password_resets SET used_at = now() WHERE user_id = ? AND used_at IS NULL").run(user.id); // solo vale el último enlace
  await db
    .prepare("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, now() + interval '30 minutes')")
    .run(user.id, sha256(token));
  return enviarRecuperacion({ to: user.email, name: user.name, token, crear });
}

// Cuenta creada con Google que quiere una contraseña: ya no se crea directo desde la sesión
// (con un token robado alguien se quedaría con acceso permanente). Se manda un enlace al correo,
// así solo la crea quien controla ese correo.
authRouter.post("/password-link", requireSession, ruta(async (req, res) => {
  if (req.user.password_hash !== "google") return res.status(400).json({ error: "Tu cuenta ya tiene contraseña. Cámbiala desde el formulario." });
  if (limOlvide.excedido(req.user.email)) return res.status(429).json({ error: MSG_LIMITE });
  await mandarEnlaceClave(req.user, { crear: true });
  res.json({ ok: true, message: `Te enviamos un enlace a ${req.user.email} para crear tu contraseña. Vale 30 minutos; revisa también la carpeta de spam.` });
}));

authRouter.post("/forgot", ruta(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 120);
  const generico = { ok: true, message: "Si ese correo tiene una cuenta, te enviamos un enlace para crear una nueva contraseña. Revisa también la carpeta de spam." };
  if (limOlvideIp.excedido(req.ip) || limOlvide.excedido(email)) return res.status(429).json({ error: MSG_LIMITE });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.json(generico);
  const user = await findUserByEmail(email);
  // Sin await: la respuesta tarda lo mismo exista o no el correo (no delata qué correos tienen cuenta).
  if (user) mandarEnlaceClave(user).catch((e) => console.error("No se pudo enviar el enlace de recuperación:", e.message));
  res.json(generico);
}));

authRouter.post("/reset", ruta(async (req, res) => {
  if (limReset.excedido(req.ip)) return res.status(429).json({ error: MSG_LIMITE });
  const token = String(req.body?.token || "");
  const errClave = validatePassword(req.body?.password);
  if (errClave) return res.status(400).json({ error: errClave });
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return res.status(400).json({ error: "El enlace no es válido o ya caducó. Pide uno nuevo." });
  const fila = await db
    .prepare("SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > now()")
    .get(sha256(token));
  if (!fila) return res.status(400).json({ error: "El enlace no es válido o ya caducó. Pide uno nuevo." });
  // Se "gasta" el enlace de forma atómica: si dos peticiones llegan a la vez, solo una continúa.
  const gastado = await db.prepare("UPDATE password_resets SET used_at = now() WHERE id = ? AND used_at IS NULL").run(fila.id);
  if (!gastado.changes) return res.status(400).json({ error: "El enlace no es válido o ya caducó. Pide uno nuevo." });
  await db
    // cierra las sesiones abiertas; y como el enlace llegó a su correo, ese correo queda verificado
    .prepare("UPDATE users SET password_hash = ?, token_version = token_version + 1, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = ?")
    .run(await hashPassword(String(req.body.password)), fila.user_id);
  await db.prepare("UPDATE password_resets SET used_at = now() WHERE user_id = ? AND used_at IS NULL").run(fila.user_id);
  const user = await findUserById(fila.user_id);
  if (user) enviarAvisoCambioClave({ to: user.email, name: user.name }).catch(() => {});
  // El 2FA (si lo tiene) NO se desactiva: al volver a entrar se le pedirá igual.
  res.json({ ok: true, message: "Contraseña actualizada. Ya puedes iniciar sesión." });
}));

// ------------------------------ verificación en dos pasos (2FA) ------------------------------
authRouter.post("/2fa/setup", requireSession, ruta(async (req, res) => {
  if (limDosPasos.excedido(req.user.id)) return res.status(429).json({ error: MSG_LIMITE });
  if (req.user.totp_enabled) return res.status(400).json({ error: "La verificación en dos pasos ya está activada." });
  // Volver a pedir la contraseña: si no, con un token robado se podría activar el 2FA,
  // quedarse con los códigos de recuperación y dejar fuera al dueño para siempre.
  if (req.user.password_hash !== "google" && !(await verifyPassword(String(req.body?.password || ""), req.user.password_hash))) {
    return res.status(401).json({ error: "La contraseña no es correcta." });
  }
  const secreto = nuevoSecreto();
  await db.prepare("UPDATE users SET totp_secret = ?, totp_last_step = NULL WHERE id = ?").run(cifrar(secreto), req.user.id);
  const otpauth = urlOtpauth(req.user.email, secreto);
  res.json({ secret: secreto, otpauth, qr: await qrComoImagen(otpauth) });
}));

authRouter.post("/2fa/enable", requireSession, ruta(async (req, res) => {
  if (limDosPasos.excedido(req.user.id)) return res.status(429).json({ error: MSG_LIMITE });
  if (req.user.totp_enabled) return res.status(400).json({ error: "La verificación en dos pasos ya está activada." });
  const secreto = req.user.totp_secret ? descifrar(req.user.totp_secret) : null;
  if (!secreto) return res.status(400).json({ error: "Primero genera el código QR." });
  const paso = verificarTotp(secreto, req.body?.code);
  if (paso == null) return res.status(400).json({ error: "Código incorrecto. Revisa la hora de tu celular e inténtalo otra vez." });
  await db.prepare("UPDATE users SET totp_enabled = true, totp_last_step = ? WHERE id = ?").run(paso, req.user.id);
  limDosPasos.reiniciar(req.user.id);
  const recoveryCodes = await crearCodigosRecuperacion(req.user.id);
  res.json({ ok: true, recoveryCodes, user: publicUser(await findUserById(req.user.id)) });
}));

authRouter.post("/2fa/disable", requireSession, ruta(async (req, res) => {
  if (limDosPasos.excedido(req.user.id)) return res.status(429).json({ error: MSG_LIMITE });
  if (!req.user.totp_enabled) return res.status(400).json({ error: "La verificación en dos pasos no está activada." });
  const tieneClave = req.user.password_hash !== "google";
  if (tieneClave && !(await verifyPassword(String(req.body?.password || ""), req.user.password_hash))) {
    return res.status(401).json({ error: "La contraseña no es correcta." });
  }
  if (!(await verificarSegundoPaso(req.user, req.body?.code))) return res.status(401).json({ error: "Código incorrecto." });
  await db.prepare("UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_last_step = NULL WHERE id = ?").run(req.user.id);
  await db.prepare("DELETE FROM recovery_codes WHERE user_id = ?").run(req.user.id);
  limDosPasos.reiniciar(req.user.id);
  res.json({ ok: true, user: publicUser(await findUserById(req.user.id)) });
}));

authRouter.post("/2fa/recovery-codes", requireSession, ruta(async (req, res) => {
  if (limDosPasos.excedido(req.user.id)) return res.status(429).json({ error: MSG_LIMITE });
  if (!req.user.totp_enabled) return res.status(400).json({ error: "La verificación en dos pasos no está activada." });
  if (!(await verificarSegundoPaso(req.user, req.body?.code))) return res.status(401).json({ error: "Código incorrecto." });
  res.json({ ok: true, recoveryCodes: await crearCodigosRecuperacion(req.user.id) });
}));

// ------------------------------ verificación de correo ------------------------------
async function enviarEnlaceVerificacion(user) {
  if (user.email_verified_at) return;
  const token = crypto.randomBytes(32).toString("base64url");
  await db.prepare("UPDATE email_verifications SET used_at = now() WHERE user_id = ? AND used_at IS NULL").run(user.id); // solo vale el último enlace
  await db
    .prepare("INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?, ?, now() + interval '24 hours')")
    .run(user.id, sha256(token));
  await enviarVerificacion({ to: user.email, name: user.name, token });
}

// Convierte en "de Google" una cuenta con contraseña que nunca verificó su correo (ver /google).
async function tomarCuentaSinVerificar(userId) {
  await db
    .prepare(
      "UPDATE users SET password_hash = 'google', token_version = token_version + 1, totp_enabled = false, totp_secret = NULL, totp_last_step = NULL, email_verified_at = now() WHERE id = ?"
    )
    .run(userId);
  await db.prepare("DELETE FROM recovery_codes WHERE user_id = ?").run(userId);
  await db.prepare("UPDATE password_resets SET used_at = now() WHERE user_id = ? AND used_at IS NULL").run(userId);
  await db.prepare("UPDATE email_verifications SET used_at = now() WHERE user_id = ? AND used_at IS NULL").run(userId);
}

authRouter.post("/verify-email", ruta(async (req, res) => {
  if (limReset.excedido(`${req.ip}|verif`)) return res.status(429).json({ error: MSG_LIMITE });
  const token = String(req.body?.token || "");
  const malo = { error: "El enlace no es válido o ya caducó. Pide uno nuevo desde tu perfil." };
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return res.status(400).json(malo);
  const gastado = await db
    .prepare("UPDATE email_verifications SET used_at = now() WHERE token_hash = ? AND used_at IS NULL AND expires_at > now() RETURNING user_id")
    .get(sha256(token));
  if (!gastado) return res.status(400).json(malo);
  await db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = ?").run(gastado.user_id);
  res.json({ ok: true, message: "Correo verificado. ¡Gracias!" });
}));

authRouter.post("/resend-verification", requireSession, ruta(async (req, res) => {
  if (req.user.email_verified_at) return res.json({ ok: true, message: "Tu correo ya está verificado." });
  if (limVerif.excedido(req.user.id)) return res.status(429).json({ error: MSG_LIMITE });
  await enviarEnlaceVerificacion(req.user);
  res.json({ ok: true, message: "Te enviamos un enlace de verificación. Revisa también la carpeta de spam." });
}));

// ------------------------------ cerrar sesión en todos los dispositivos ------------------------------
authRouter.post("/logout-all", requireSession, ruta(async (req, res) => {
  await db.prepare("UPDATE users SET token_version = token_version + 1 WHERE id = ?").run(req.user.id);
  // Esta sesión sigue activa con un token nuevo; todas las demás dejan de servir.
  res.json({ ok: true, token: signToken(await findUserById(req.user.id)) });
}));

// ------------------------------ middlewares ------------------------------
// Lee "Authorization: Bearer <token>" y deja el usuario en req.user (o null).
export async function authOptional(req, _res, next) {
  try {
    const h = req.headers.authorization || "";
    req.user = h.startsWith("Bearer ") ? await userFromToken(h.slice(7)) : null;
  } catch (e) {
    console.error("Error leyendo la sesión:", e.message);
    req.user = null;
  }
  next();
}

export function requireTeacher(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Inicia sesión como docente para crear una partida." });
  if (req.user.role !== "docente") return res.status(403).json({ error: "Solo las cuentas de docente pueden crear partidas." });
  next();
}