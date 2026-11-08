// Carga backend/.env ANTES que cualquier otro módulo (los imports de ES se ejecutan
// antes que el código de server.js, por eso esto vive en su propio archivo).
import fs from "node:fs";

try {
  const txt = fs.readFileSync(new URL("./.env", import.meta.url), "utf8");
  for (const linea of txt.split("\n")) {
    const m = linea.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    let valor = (m[2] || "").trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = valor;
  }
} catch {
  // No hay .env: se usan las variables que ya existan en el entorno.
}
