import { describe, it, expect } from "vitest";
import { normalizeWord, checkWord } from "./palabraDiccionario";

describe("Palabra Relámpago: diccionario", () => {
  it("normaliza tildes y mayúsculas pero conserva la ñ", () => {
    expect(normalizeWord("  Canción ")).toBe("cancion");
    expect(normalizeWord("NIÑO")).toBe("niño");
  });

  it("acepta una palabra con el fragmento y explica por qué rechaza las demás", () => {
    const extra = new Set(["casona"]);
    expect(checkWord("Casona", "ca", [], extra)).toBe("");
    expect(checkWord("casona", "ca", ["casona"], extra)).toMatch(/ya fue utilizada/);
    expect(checkWord("casona", "zz", [], extra)).toMatch(/debe contener/);
    expect(checkWord("ca", "ca", [], extra)).toMatch(/4 a 35/);
  });
});
