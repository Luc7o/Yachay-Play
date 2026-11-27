// Comparación visual sobre el build de PRODUCCIÓN (ver e2e/visual.spec.js).
//   npm run e2e:visual                         compara
//   npm run e2e:visual -- --update-snapshots   guarda nuevas referencias
import { defineConfig, devices } from "@playwright/test";

process.env.VISUAL = "1"; // activa e2e/visual.spec.js (en la configuración normal se salta)

const FRONT = 5182;
const API = 4012;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "visual.spec.js",
  snapshotPathTemplate: "e2e/__capturas__/{arg}{ext}",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${FRONT}`, ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
  webServer: [
    {
      command: "npm --prefix ../backend run dev:db",
      port: API,
      reuseExistingServer: false,
      timeout: 90_000,
      env: { DEV_DB_PORT: "5439", DEV_DB_BACKEND: "1", PORT: String(API), CORS_ORIGIN: `http://localhost:${FRONT}` },
    },
    {
      command: `npx vite build && npx vite preview --port ${FRONT} --strictPort`,
      url: `http://localhost:${FRONT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: `http://localhost:${API}` },
    },
  ],
});
