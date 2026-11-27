import { describe, it, expect } from "vitest";
import { crearRegistro, normalizarCodigo } from "./salas.js";

describe("registro de salas", () => {
  it("normaliza el código", () => {
    expect(normalizarCodigo(" 123456 ")).toBe("123456");
    expect(normalizarCodigo(undefined)).toBe("");
    expect(normalizarCodigo(123456)).toBe("123456");
  });

  it("guarda, obtiene (con espacios) y quita", () => {
    const r = crearRegistro();
    const sala = r.guardar({ code: r.nuevoCodigo(), createdAt: Date.now() });
    expect(sala.code).toMatch(/^\d{6}$/);
    expect(r.obtener(` ${sala.code}\n`)).toBe(sala);
    expect(r.obtener("")).toBeNull();
    expect(r.obtener(null)).toBeNull();
    r.quitar({ code: sala.code }); // otro objeto con el mismo código: no se borra
    expect(r.obtener(sala.code)).toBe(sala);
    r.quitar(sala);
    expect(r.salas.size).toBe(0);
  });

  it("purga las salas viejas y las devuelve", () => {
    const r = crearRegistro();
    const vieja = r.guardar({ code: "111111", createdAt: 100 });
    r.guardar({ code: "222222", createdAt: 300 });
    expect(r.purgarViejas(200)).toEqual([vieja]);
    expect([...r.salas.keys()]).toEqual(["222222"]);
  });

  it("acepta otra regla de último uso", () => {
    const r = crearRegistro({ ultimoUso: (s) => Math.max(s.createdAt, s.lastUsed) });
    r.guardar({ code: "111111", createdAt: 100, lastUsed: 500 });
    expect(r.purgarViejas(200)).toEqual([]);
    expect(r.salas.size).toBe(1);
  });
});
