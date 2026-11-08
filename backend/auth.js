// Rutas y middlewares de autenticación para Express.
import { Router } from "express";
import {
  createUser,
  findUserByEmail,
  hashPassword,
  publicUser,
  signToken,
  userFromToken,
  validateRegistration,
  verifyPassword,
} from "./authCore.js";
import { DEMO_USERS, demoEnabled } from "./seed.js";

export const authRouter = Router();

// --- Freno sencillo contra adivinar contraseñas: 10 intentos cada 10 minutos ---
const intentos = new Map();
function demasiados(clave) {
  const ahora = Date.now();
  const a = intentos.get(clave);
  if (!a || ahora - a.inicio > 10 * 60 * 1000) {
    intentos.set(clave, { n: 1, inicio: ahora });
    return false;
  }
  a.n += 1;
  return a.n > 10;
}
const DUMMY_HASH = hashPassword("relleno-para-igualar-tiempos");

authRouter.post("/register", async (req, res) => {
  const { error, data } = validateRegistration(req.body || {});
  if (error) return res.status(400).json({ error });
  if (await findUserByEmail(data.email)) return res.status(409).json({ error: "Ya existe una cuenta con ese correo." });
  const user = await createUser(data);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (demasiados(`${req.ip}|${email}`)) {
    return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo otra vez." });
  }
  const user = await findUserByEmail(email);
  // Siempre verificamos un hash (aunque el correo no exista) para no delatar qué correos están registrados.
  const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  intentos.delete(`${req.ip}|${email}`);
  res.json({ token: signToken(user), user: publicUser(user) });
});

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
