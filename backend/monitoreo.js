// ============================================================================
// MONITOREO DE ERRORES DEL SERVIDOR (Rollbar)
// ----------------------------------------------------------------------------
// Activo solo en producción y si hay token de servidor (post_server_item):
//   ROLLBAR_SERVER_TOKEN=...      (en el panel del hosting del backend)
// Si el hosting es Vercel, la integración crea ROLLBAR_*_SERVER_TOKEN_* y
// también se reconoce.
//
// Qué se envía:
//   - excepciones sin capturar y promesas rechazadas sin manejar;
//   - todo lo que el servidor escribe con console.error (las rutas ya registran
//     ahí sus fallos), con el error y su stack cuando lo hay.
// No se envían cuerpos de peticiones, contraseñas ni datos de usuarios.
// ============================================================================
import Rollbar from "rollbar";

const token =
  process.env.ROLLBAR_SERVER_TOKEN ||
  Object.entries(process.env).find(([k]) => /^ROLLBAR_.*SERVER_TOKEN/.test(k))?.[1] ||
  "";

const activo = Boolean(token) && process.env.NODE_ENV === "production";

/** @type {Rollbar | null} */
export const rollbar = activo
  ? new Rollbar({
      accessToken: token,
      environment: process.env.ROLLBAR_ENV || "production",
      captureUncaught: true,
      // las promesas sin manejar ya pasan por console.error (server.js): no se duplican
      captureUnhandledRejections: false,
      itemsPerMinute: 30, // un fallo repetido no agota el plan
      captureIp: false,
      scrubFields: ["password", "token", "secret", "code", "challenge", "authorization", "cookie"],
    })
  : null;

if (rollbar) {
  // Todo console.error también va a Rollbar (sin dejar de verse en la consola del hosting).
  const original = console.error.bind(console);
  console.error = (...args) => {
    original(...args);
    try {
      const err = args.find((a) => a instanceof Error);
      const texto = args
        .filter((a) => !(a instanceof Error))
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
        .join(" ")
        .slice(0, 500);
      if (err) rollbar.error(texto || err.message, err);
      else rollbar.error(texto);
    } catch {
      /* el monitoreo nunca debe tumbar el servidor */
    }
  };
  console.log("Monitoreo de errores: Rollbar activo");
}
