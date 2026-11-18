// ============================================================================
// ENVÍO DE CORREOS (recuperar contraseña) con Resend — https://resend.com
// ============================================================================
// Variables de entorno (backend/.env):
//   RESEND_API_KEY=re_xxxxxxxx                              (clave de Resend)
//   MAIL_FROM=YachayPlay <no-responder@yachayplay.com>      (el dominio debe estar verificado en Resend)
//   FRONTEND_URL=https://www.yachayplay.com                 (para armar el enlace del correo)
//
// Sin RESEND_API_KEY: en desarrollo el enlace se imprime en la consola del backend,
// para que puedas probar sin enviar correos reales.
// ============================================================================
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const frontendUrl = () =>
  (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || "").split(",")[0] || "http://localhost:5173").trim().replace(/\/+$/, "");

async function enviar({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.error("[mailer] Falta RESEND_API_KEY: no se pudo enviar el correo a", to);
      return false;
    }
    console.log(`\n[mailer · DESARROLLO] Correo para ${to}\nAsunto: ${subject}\n${text}\n`);
    return true;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "YachayPlay <onboarding@resend.dev>", to: [to], subject, html, text }),
    });
    if (!r.ok) {
      console.error("[mailer] Resend respondió", r.status, (await r.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mailer] No se pudo contactar con Resend:", e.message);
    return false;
  }
}

export function enviarRecuperacion({ to, name, token }) {
  const enlace = `${frontendUrl()}/#/restablecer/${token}`;
  const subject = "Restablece tu contraseña de YachayPlay";
  const text =
    `Hola ${name},\n\nRecibimos una solicitud para restablecer tu contraseña de YachayPlay.\n` +
    `Abre este enlace (vale 30 minutos y solo se puede usar una vez):\n${enlace}\n\n` +
    `Si no fuiste tú, ignora este correo: tu contraseña no cambiará.\n\n— Equipo YachayPlay`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#073b47">` +
    `<h2 style="color:#00796f">YachayPlay</h2>` +
    `<p>Hola ${esc(name)},</p>` +
    `<p>Recibimos una solicitud para restablecer tu contraseña. El enlace vale <strong>30 minutos</strong> y solo se puede usar una vez.</p>` +
    `<p style="margin:28px 0"><a href="${esc(enlace)}" style="background:#0b5550;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Crear nueva contraseña</a></p>` +
    `<p style="font-size:13px;color:#5a7a80">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${esc(enlace)}</p>` +
    `<p style="font-size:13px;color:#5a7a80">Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p></div>`;
  return enviar({ to, subject, html, text });
}

export function enviarAvisoCambioClave({ to, name }) {
  const subject = "Tu contraseña de YachayPlay fue cambiada";
  const text = `Hola ${name},\n\nTu contraseña de YachayPlay acaba de cambiarse y se cerraron las sesiones abiertas.\nSi no fuiste tú, restablécela de inmediato desde "¿Olvidaste tu contraseña?" y contáctanos.\n\n— Equipo YachayPlay`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#073b47"><h2 style="color:#00796f">YachayPlay</h2><p>Hola ${esc(name)},</p><p>Tu contraseña acaba de cambiarse y se cerraron las sesiones abiertas.</p><p>Si no fuiste tú, restablécela de inmediato desde «¿Olvidaste tu contraseña?» y contáctanos.</p></div>`;
  return enviar({ to, subject, html, text });
}

export function enviarVerificacion({ to, name, token }) {
  const enlace = `${frontendUrl()}/#/verificar/${token}`;
  const subject = "Confirma tu correo de YachayPlay";
  const text =
    `Hola ${name},\n\n¡Bienvenido/a a YachayPlay! Confirma que este correo es tuyo abriendo este enlace (vale 24 horas):\n${enlace}\n\n` +
    `Si no creaste la cuenta, ignora este correo.\n\n— Equipo YachayPlay`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#073b47">` +
    `<h2 style="color:#00796f">YachayPlay</h2>` +
    `<p>Hola ${esc(name)},</p>` +
    `<p>¡Bienvenido/a! Confirma que este correo es tuyo. El enlace vale <strong>24 horas</strong>.</p>` +
    `<p style="margin:28px 0"><a href="${esc(enlace)}" style="background:#0b5550;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Confirmar mi correo</a></p>` +
    `<p style="font-size:13px;color:#5a7a80">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${esc(enlace)}</p>` +
    `<p style="font-size:13px;color:#5a7a80">Si no creaste la cuenta, ignora este correo.</p></div>`;
  return enviar({ to, subject, html, text });
}
