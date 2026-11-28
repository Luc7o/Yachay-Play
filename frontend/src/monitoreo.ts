// ============================================================================
// MONITOREO DE ERRORES (Rollbar)
// ----------------------------------------------------------------------------
// Avisa de los errores que pasan en el navegador de docentes y estudiantes:
// excepciones sin capturar, promesas rechazadas y la pantalla "Algo salió mal"
// (ErrorBoundary). Solo funciona en el build de producción y si hay token.
//
// El token es el de cliente (post_client_item): está hecho para ir en el
// navegador. Lo crea la integración de Rollbar en Vercel y vite.config.js lo
// expone como VITE_ROLLBAR_TOKEN.
//
// Privacidad: no se envía quién es el usuario ni el contenido de formularios;
// solo el error, la pantalla (URL con #) y el navegador.
// ============================================================================
import Rollbar from "rollbar";

const token = import.meta.env.VITE_ROLLBAR_TOKEN as string | undefined;

export const rollbar = new Rollbar({
  accessToken: token || "sin-token",
  enabled: Boolean(token) && import.meta.env.PROD,
  captureUncaught: true,
  captureUnhandledRejections: true,
  environment: (import.meta.env.VITE_ENTORNO as string) || "production",
  codeVersion: (import.meta.env.VITE_VERSION as string) || undefined,
  // Ruido conocido que no es un fallo de la app
  ignoredMessages: [
    "ResizeObserver loop",
    "Script error.",
    "Failed to fetch dynamically imported module", // pestaña vieja tras un despliegue nuevo
  ],
  // Un error que se repite en bucle no debe agotar el plan (5.000 al mes)
  itemsPerMinute: 10,
  maxItems: 40,
  captureIp: false,
  autoInstrument: { network: false, log: false, dom: false, navigation: true, connectivity: true },
});

/** Reporta un error ya capturado (p. ej. en un ErrorBoundary). */
export function reportarError(error: unknown, contexto?: Record<string, unknown>): void {
  rollbar.error(error instanceof Error ? error : String(error), contexto);
}
