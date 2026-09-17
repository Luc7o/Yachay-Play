import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // permite acceder desde los celulares en la misma red Wi-Fi
    port: 5173,
  },
});
