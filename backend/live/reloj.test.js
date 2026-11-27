import { describe, it, expect, vi, afterEach } from "vitest";
import { crearReloj } from "./reloj.js";

describe("reloj único", () => {
  afterEach(() => vi.useRealTimers());

  it("usa el MCD de los periodos como base y respeta el periodo de cada tick", () => {
    const reloj = crearReloj();
    const lento = vi.fn();
    const rapido = vi.fn();
    reloj.registrar("lento", 1000, lento);
    reloj.registrar("rapido", 500, rapido);
    expect(reloj.base).toBe(500);
    for (let i = 0; i < 4; i++) reloj.pulso(); // 2 s
    expect(rapido).toHaveBeenCalledTimes(4);
    expect(lento).toHaveBeenCalledTimes(2);
  });

  it("corre con setInterval y se detiene", () => {
    vi.useFakeTimers();
    const reloj = crearReloj();
    const t = vi.fn();
    reloj.registrar("t", 1000, t);
    reloj.iniciar();
    vi.advanceTimersByTime(3000);
    expect(t).toHaveBeenCalledTimes(3);
    reloj.detener();
    vi.advanceTimersByTime(3000);
    expect(t).toHaveBeenCalledTimes(3);
  });

  it("un tick que falla no frena a los demás", async () => {
    const alFallar = vi.fn();
    const reloj = crearReloj({ alFallar });
    const bueno = vi.fn();
    reloj.registrar("roto", 1000, () => {
      throw new Error("ups");
    });
    reloj.registrar("promesa", 1000, () => Promise.reject(new Error("async")));
    reloj.registrar("bueno", 1000, bueno);
    reloj.pulso();
    await Promise.resolve();
    expect(bueno).toHaveBeenCalledTimes(1);
    expect(alFallar).toHaveBeenCalledWith("roto", expect.any(Error));
    expect(alFallar).toHaveBeenCalledWith("promesa", expect.any(Error));
  });

  it("rechaza periodos inválidos y registros tardíos", () => {
    vi.useFakeTimers();
    const reloj = crearReloj();
    expect(() => reloj.registrar("x", 0, () => {})).toThrow();
    expect(() => reloj.registrar("x", 1.5, () => {})).toThrow();
    reloj.registrar("ok", 1000, () => {});
    reloj.iniciar();
    expect(() => reloj.registrar("tarde", 1000, () => {})).toThrow();
    reloj.detener();
  });
});
