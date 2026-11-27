import { describe, it, expect, vi } from "vitest";
import { motivoNoDueno, esDueno, crearGuardDueno, crearAccionesDeAnfitrion } from "./dueno.js";

const docente = { id: 1, role: "docente" };
const otroDocente = { id: 2, role: "docente" };
const estudiante = { id: 3, role: "estudiante" };

describe("guard de anfitrión", () => {
  it("da el motivo correcto", () => {
    expect(motivoNoDueno(null, { ownerId: 1 })).toBe("sin-sesion");
    expect(motivoNoDueno(estudiante, { ownerId: 3 })).toBe("sin-sesion");
    expect(motivoNoDueno(docente, { ownerId: null })).toBe("sin-dueno");
    expect(motivoNoDueno(otroDocente, { ownerId: 1 })).toBe("otro");
    expect(motivoNoDueno(docente, { ownerId: 1 })).toBeNull();
  });

  it("sin dueño nadie controla la sala (ni siquiera con requiereDocente = false)", () => {
    expect(esDueno(estudiante, { ownerId: null }, { requiereDocente: false })).toBe(false);
    expect(esDueno({ id: null }, { ownerId: null }, { requiereDocente: false })).toBe(false);
  });

  it("requiereDocente = false deja controlar a un estudiante dueño", () => {
    expect(esDueno(estudiante, { ownerId: 3 }, { requiereDocente: false })).toBe(true);
    expect(esDueno(estudiante, { ownerId: 3 })).toBe(false);
  });

  it("crearGuardDueno devuelve el mensaje de cada juego", () => {
    const guard = crearGuardDueno({ sinSesion: "A", otro: "B", sinDueno: "C" });
    expect(guard(null, { ownerId: 1 })).toBe("A");
    expect(guard(otroDocente, { ownerId: 1 })).toBe("B");
    expect(guard(docente, { ownerId: null })).toBe("C");
    expect(guard(docente, { ownerId: 1 })).toBeNull();
  });
});

describe("acciones de anfitrión", () => {
  const preparar = (user) => {
    const handlers = {};
    const socket = { data: { user }, on: (ev, fn) => (handlers[ev] = fn) };
    const salas = { 111111: { code: "111111", ownerId: 1 } };
    const despues = vi.fn();
    const guard = crearGuardDueno({ sinSesion: "sesion", otro: "otro", sinDueno: "nadie" });
    const anfitrion = crearAccionesDeAnfitrion(socket, {
      buscar: ({ code }) => salas[code] || null,
      noExiste: "no existe",
      problema: (sala) => guard(socket.data.user, sala),
      despues,
    });
    return { handlers, anfitrion, despues };
  };

  it("ejecuta la acción solo para el dueño y avisa después", () => {
    const { handlers, anfitrion, despues } = preparar(docente);
    anfitrion("x:start", () => ({ extra: 1 }));
    const ack = vi.fn();
    handlers["x:start"]({ code: "111111" }, ack);
    expect(ack).toHaveBeenCalledWith({ ok: true, extra: 1 });
    expect(despues).toHaveBeenCalledTimes(1);
  });

  it("responde el error sin avisar a la sala", () => {
    const { handlers, anfitrion, despues } = preparar(docente);
    anfitrion("x:start", () => ({ error: "aún no" }));
    const ack = vi.fn();
    handlers["x:start"]({ code: "111111" }, ack);
    handlers["x:start"]({ code: "999999" }, ack);
    handlers["x:start"](null, ack); // sin datos: no se cae
    expect(ack.mock.calls.map((c) => c[0].error)).toEqual(["aún no", "no existe", "no existe"]);
    expect(despues).not.toHaveBeenCalled();
  });

  it("rechaza a quien no es dueño", () => {
    const { handlers, anfitrion } = preparar(otroDocente);
    const accion = vi.fn();
    anfitrion("x:start", accion);
    const ack = vi.fn();
    handlers["x:start"]({ code: "111111" }, ack);
    expect(ack).toHaveBeenCalledWith({ error: "otro" });
    expect(accion).not.toHaveBeenCalled();
  });
});
