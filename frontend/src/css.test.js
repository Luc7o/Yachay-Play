// En producción todo el CSS va en UN archivo: un solo error de sintaxis anula las reglas que
// vienen después (en desarrollo cada archivo va aparte y el error pasa casi inadvertido).
// Esta prueba busca los errores que ya ocurrieron: cadenas entre comillas partidas en varias
// líneas y llaves, paréntesis o corchetes desbalanceados.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function archivosCss(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivosCss(p) : p.endsWith(".css") ? [p] : [];
  });
}

// Recorre el CSS saltando comentarios y cadenas; devuelve los problemas encontrados.
function revisar(css) {
  const problemas = [];
  const pila = [];
  const pares = { "}": "{", ")": "(", "]": "[" };
  let linea = 1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\n") linea++;
    if (c === "/" && css[i + 1] === "*") {
      const fin = css.indexOf("*/", i + 2);
      linea += (css.slice(i, fin).match(/\n/g) || []).length;
      i = fin + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const fin = css.indexOf(c, i + 1);
      const cadena = css.slice(i, fin + 1);
      if (fin < 0 || cadena.includes("\n")) problemas.push(`línea ${linea}: cadena partida ${cadena.slice(0, 40)}`);
      linea += (cadena.match(/\n/g) || []).length;
      i = fin < 0 ? css.length : fin;
      continue;
    }
    if ("{([".includes(c)) pila.push(c);
    else if (pares[c]) {
      if (pila.pop() !== pares[c]) problemas.push(`línea ${linea}: "${c}" sin abrir`);
    }
  }
  if (pila.length) problemas.push(`quedan sin cerrar: ${pila.join(" ")}`);
  return problemas;
}

describe("CSS válido (lo que en producción va en un solo archivo)", () => {
  for (const archivo of archivosCss(join(__dirname))) {
    it(archivo.replace(/^.*src[\\/]/, ""), () => {
      expect(revisar(readFileSync(archivo, "utf8"))).toEqual([]);
    });
  }
});
