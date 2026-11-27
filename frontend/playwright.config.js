// ============================================================================
// PRUEBAS DE PUNTA A PUNTA (Playwright)
// ----------------------------------------------------------------------------
// npm run e2e   (desde frontend/)
// Levanta su propia base de datos en memoria + backend (puertos 5437 / 4011) y
// el frontend (5181), así no choca con lo que tengas corriendo en desarrollo.
// ============================================================================
import { defineConfig, devices } from "@playwright/test";

const FRONT = 5181;
const API = 4011;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // comparten la misma base de datos
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${FRONT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      // Base de datos en memoria (PGlite) + migraciones + backend con cuentas demo
      command: "npm --prefix ../backend run dev:db",
      port: API,
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        DEV_DB_PORT: "5437",
        DEV_DB_BACKEND: "1",
        PORT: String(API),
        CORS_ORIGIN: `http://localhost:${FRONT}`,
      },
    },
    {
      command: `npx vite --port ${FRONT} --strictPort`,
      url: `http://localhost:${FRONT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: `http://localhost:${API}` },
    },
  ],
});
