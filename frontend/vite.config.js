import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Monitoreo de errores (src/monitoreo.ts): la integración de Rollbar en Vercel crea
// NEXT_PUBLIC_ROLLBAR_*_CLIENT_TOKEN_*. Vite solo expone VITE_*, así que se pasa aquí.
// En local se lee también el .env.local de la raíz (lo baja `vercel env pull`).
function monitoreo(mode) {
  const env = { ...loadEnv(mode, "..", ""), ...loadEnv(mode, ".", ""), ...process.env };
  const clave = Object.keys(env).find((k) => /^NEXT_PUBLIC_ROLLBAR_.*CLIENT_TOKEN/.test(k));
  return {
    "import.meta.env.VITE_ROLLBAR_TOKEN": JSON.stringify(clave ? env[clave] : ""),
    "import.meta.env.VITE_ENTORNO": JSON.stringify(env.VERCEL_ENV || mode),
    "import.meta.env.VITE_VERSION": JSON.stringify(env.VERCEL_GIT_COMMIT_SHA || ""),
  };
}

export default defineConfig(({ mode }) => ({
  define: monitoreo(mode),
  plugins: [react()],
  test: { environment: "jsdom", exclude: ["e2e/**", "node_modules/**"] },
  server: {
    host: true, // permite acceder desde los celulares en la misma red Wi-Fi
    port: 5173,
  },
}));
