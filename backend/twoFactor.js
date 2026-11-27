// ============================================================================
// VERIFICACIÓN EN DOS PASOS (2FA) con códigos TOTP (RFC 6238)
// ============================================================================
// Compatible con Google Authenticator, Microsoft Authenticator, Authy, 1Password...
// No necesita librerías: usa solo node:crypto. (El QR usa el paquete opcional "qrcode".)
//
// - El secreto de cada usuario se guarda CIFRADO (AES-256-GCM) en users.totp_secret.
// - Un código ya usado no se puede reutilizar (users.totp_last_step).
// - Al activar se entregan 8 códigos de recuperación de un solo uso (se guarda solo su hash).
// ============================================================================
import crypto from "node:crypto";
import db from "./db.js";
import { getAuthSecret } from "./authCore.js";

const ISSUER = "YachayPlay";
const PERIODO = 30; // segundos de vida de cada código
const DIGITOS = 6;
const VENTANA = 1; // se aceptan el código anterior y el siguiente (relojes un poco desfasados)
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// ------------------------------ base32 ------------------------------
function base32Encode(buf) {
  let bits = 0,
    valor = 0,
    out = "";
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(valor << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0,
    valor = 0;
  const out = [];
  for (const c of String(str).toUpperCase().replace(/=+$/, "")) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ------------------------------ TOTP ------------------------------
export const nuevoSecreto = () => base32Encode(crypto.randomBytes(20)); // 160 bits

function codigoPara(secretoB32, paso) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const h = crypto.createHmac("sha1", base32Decode(secretoB32)).update(contador).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** DIGITOS).padStart(DIGITOS, "0");
}

// Devuelve el "paso" (número) en que coincidió el código, o null si no es válido.
// `ultimoPaso` impide reutilizar un código (o uno anterior) ya aceptado.
export function verificarTotp(secretoB32, codigo, ultimoPaso = null) {
  const c = String(codigo || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const actual = Math.floor(Date.now() / 1000 / PERIODO);
  for (let d = -VENTANA; d <= VENTANA; d++) {
    const paso = actual + d;
    if (ultimoPaso != null && paso <= Number(ultimoPaso)) continue;
    const esperado = Buffer.from(codigoPara(secretoB32, paso));
    if (crypto.timingSafeEqual(esperado, Buffer.from(c))) return paso;
  }
  return null;
}

export const urlOtpauth = (email, secretoB32) =>
  `otpauth://totp/${encodeURIComponent(`${ISSUER}:${email}`)}?secret=${secretoB32}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITOS}&period=${PERIODO}`;

// QR como imagen "data:" (si el paquete "qrcode" no está instalado, devuelve null y la app
// muestra solo la clave para escribirla a mano).
export async function qrComoImagen(texto) {
  try {
    const QR = (await import("qrcode")).default;
    return await QR.toDataURL(texto, { margin: 1, width: 220 });
  } catch {
    return null;
  }
}

// ------------------------- cifrado del secreto -------------------------
const clave = () => crypto.createHash("sha256").update(`yachayplay-2fa|${getAuthSecret()}`).digest();

export function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", clave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function descifrar(almacenado) {
  try {
    const [v, iv, tag, enc] = String(almacenado).split(".");
    if (v !== "v1") return null;
    const d = crypto.createDecipheriv("aes-256-gcm", clave(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null; // AUTH_SECRET cambió o el dato está dañado
  }
}

// ------------------------- códigos de recuperación -------------------------
const hashCodigo = (c) =>
  crypto
    .createHash("sha256")
    .update(
      String(c)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
    )
    .digest("hex");

function codigoRecuperacion() {
  const raw = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 caracteres hex
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

// Borra los anteriores y crea 8 nuevos. Devuelve los códigos en claro (se muestran UNA sola vez).
export async function crearCodigosRecuperacion(userId) {
  const codigos = Array.from({ length: 8 }, codigoRecuperacion);
  // En una transacción: si algo falla a mitad, la cuenta no queda con menos códigos.
  const cliente = await db.pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
    for (const c of codigos) {
      await cliente.query("INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)", [userId, hashCodigo(c)]);
    }
    await cliente.query("COMMIT");
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  return codigos;
}

// Consume un código de recuperación (un solo uso). true si era válido.
export async function usarCodigoRecuperacion(userId, codigo) {
  const c = String(codigo || "").trim();
  if (!/^[A-Za-z0-9]{5}-?[A-Za-z0-9]{5}$/.test(c)) return false;
  const r = await db
    .prepare("UPDATE recovery_codes SET used_at = now() WHERE user_id = ? AND code_hash = ? AND used_at IS NULL")
    .run(userId, hashCodigo(c));
  return r.changes > 0;
}

export const codigosRestantes = async (userId) =>
  (await db.prepare("SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL").get(userId)).n;

// Comprueba un código de 2.º paso del usuario: TOTP del celular o código de recuperación.
// Devuelve true/false y, si fue TOTP, guarda el paso para que no se reutilice.
export async function verificarSegundoPaso(user, codigo) {
  const entrada = String(codigo || "").trim();
  if (/^\d[\d\s]{5,}$/.test(entrada)) {
    const secreto = user.totp_secret ? descifrar(user.totp_secret) : null;
    if (!secreto) return false;
    const paso = verificarTotp(secreto, entrada, user.totp_last_step);
    if (paso == null) return false;
    // UPDATE condicional: si dos peticiones usan el mismo código a la vez, solo una gana.
    const r = await db
      .prepare("UPDATE users SET totp_last_step = ? WHERE id = ? AND (totp_last_step IS NULL OR totp_last_step < ?)")
      .run(paso, user.id, paso);
    return r.changes > 0;
  }
  return await usarCodigoRecuperacion(user.id, entrada);
}
