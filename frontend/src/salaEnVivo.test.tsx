// useSalaEnVivo y emitirConTiempo con un socket de mentira (sin servidor).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

type Fn = (...a: unknown[]) => void;
const falso = vi.hoisted(() => {
  const oyentes = new Map<string, Set<Fn>>();
  return {
    oyentes,
    connected: true,
    on(e: string, f: Fn) {
      if (!oyentes.has(e)) oyentes.set(e, new Set());
      oyentes.get(e)!.add(f);
    },
    off(e: string, f: Fn) {
      oyentes.get(e)?.delete(f);
    },
    emit: vi.fn(),
    disparar(e: string, ...a: unknown[]) {
      for (const f of oyentes.get(e) || []) f(...a);
    },
  };
});
vi.mock("./socket", () => ({ socket: falso }));

import { useSalaEnVivo, emitirConTiempo } from "./salaEnVivo";

beforeEach(() => {
  falso.oyentes.clear();
  falso.emit.mockReset();
});

describe("useSalaEnVivo", () => {
  it("reenvía los eventos siempre al manejador más reciente, sin volver a suscribirse", () => {
    const primero = vi.fn();
    const segundo = vi.fn();
    const { rerender } = renderHook(({ f }) => useSalaEnVivo({ eventos: { "cw:state": f } }), {
      initialProps: { f: primero },
    });
    const suscritos = falso.oyentes.get("cw:state")!.size;
    rerender({ f: segundo });
    expect(falso.oyentes.get("cw:state")!.size).toBe(suscritos);
    falso.disparar("cw:state", { fase: "juego" });
    expect(primero).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledWith({ fase: "juego" });
  });

  it("al reconectarse vuelve a entrar a la sala y avisa el estado de conexión", () => {
    const alReconectar = vi.fn();
    const { result } = renderHook(() => useSalaEnVivo({ alReconectar }));
    expect(result.current.conectado).toBe(true);
    act(() => falso.disparar("disconnect"));
    expect(result.current.conectado).toBe(false);
    act(() => falso.disparar("connect"));
    expect(result.current.conectado).toBe(true);
    expect(alReconectar).toHaveBeenCalledTimes(1);
  });

  it("al desmontar deja de escuchar", () => {
    const f = vi.fn();
    const { unmount } = renderHook(() => useSalaEnVivo({ eventos: { "cw:state": f } }));
    unmount();
    falso.disparar("cw:state", {});
    expect(f).not.toHaveBeenCalled();
    expect(falso.oyentes.get("connect")?.size ?? 0).toBe(0);
  });

  it("inactivo no se suscribe a nada", () => {
    renderHook(() => useSalaEnVivo({ eventos: { "cw:state": vi.fn() }, activo: false }));
    expect(falso.oyentes.get("cw:state")?.size ?? 0).toBe(0);
  });
});

describe("emitirConTiempo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("entrega la respuesta del servidor", () => {
    falso.emit.mockImplementation((_e, _d, cb) => cb({ ok: true }));
    const r = vi.fn();
    emitirConTiempo("qz:join", { code: "123456" }, r);
    expect(falso.emit).toHaveBeenCalledWith("qz:join", { code: "123456" }, expect.any(Function));
    expect(r).toHaveBeenCalledWith({ ok: true });
    vi.advanceTimersByTime(10_000);
    expect(r).toHaveBeenCalledTimes(1);
  });

  it("si el servidor no contesta, responde con un error y luego ignora la respuesta tardía", () => {
    let ack: Fn = () => {};
    falso.emit.mockImplementation((_e, _d, cb) => (ack = cb));
    const r = vi.fn();
    emitirConTiempo("qz:join", {}, r, 1000);
    vi.advanceTimersByTime(999);
    expect(r).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(r).toHaveBeenCalledWith({ error: expect.stringMatching(/no respondió a tiempo/) });
    ack({ ok: true });
    expect(r).toHaveBeenCalledTimes(1);
  });
});
