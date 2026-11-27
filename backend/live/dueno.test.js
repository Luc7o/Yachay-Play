import { describe, it, expect } from "vitest";
import { motivoNoDueno, esDueno, crearGuardDueno } from "./dueno.js";

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
