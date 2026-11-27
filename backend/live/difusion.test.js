import { describe, it, expect, vi } from "vitest";
import { enviarVistas } from "./difusion.js";

const socket = (data) => ({ data, emit: vi.fn() });

describe("difusión por socket", () => {
  it("manda a cada socket su propia vista y salta los que no pertenecen", async () => {
    const a = socket({ code: "1", who: "ana" });
    const b = socket({ code: "1", who: "beto" });
    const fuera = socket({ code: "2", who: "otro" });
    const io = { in: vi.fn(() => ({ fetchSockets: async () => [a, b, fuera] })) };

    const n = await enviarVistas(io, "x:1", {
      evento: "x:state",
      pertenece: (d) => d.code === "1",
      vista: (d) => ({ hola: d.who }),
    });

    expect(io.in).toHaveBeenCalledWith("x:1");
    expect(n).toBe(2);
    expect(a.emit).toHaveBeenCalledWith("x:state", { hola: "ana" });
    expect(b.emit).toHaveBeenCalledWith("x:state", { hola: "beto" });
    expect(fuera.emit).not.toHaveBeenCalled();
  });

  it("no falla con un io sin fetchSockets", async () => {
    const io = { in: () => ({}) };
    expect(await enviarVistas(io, "x:1", { evento: "e", vista: () => ({}) })).toBe(0);
  });
});
