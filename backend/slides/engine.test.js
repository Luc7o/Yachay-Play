import { describe, it, expect, beforeEach } from "vitest";
import * as ss from "./engine.js";

describe("Presentaciones en vivo: salas en memoria", () => {
  beforeEach(() => ss.rooms.clear());

  it("crea salas con código único y las encuentra con espacios", () => {
    const a = ss.createRoom({ name: "  Mi   clase ", ownerId: 1 });
    const b = ss.createRoom({ ownerId: 1 });
    expect(a.code).toMatch(/^\d{6}$/);
    expect(a.code).not.toBe(b.code);
    expect(a.name).toBe("Mi clase");
    expect(ss.getRoom(` ${a.code} `)).toBe(a);
  });

  it("borrar la quita de la memoria y la marca para no volver a guardarla", () => {
    const a = ss.createRoom({ ownerId: 1 });
    ss.deleteRoom(a);
    expect(a.deleted).toBe(true);
    expect(ss.getRoom(a.code)).toBeNull();
  });

  it("purga solo las salas sin uso (creación, docente o estudiantes)", () => {
    const vieja = ss.createRoom({ ownerId: 1 });
    const usada = ss.createRoom({ ownerId: 1 });
    const conAlumno = ss.restaurar({
      id: "r1",
      code: "123456",
      name: "Restaurada",
      ownerId: 1,
      createdAt: 0,
      decks: [{ key: "k", name: "Equipo", deck: null }],
      students: [{ id: "s1", name: "Ana", deckKey: "k" }],
    });
    const limite = Date.now() + 1000;
    vieja.createdAt = vieja.lastUsed = 0;
    usada.createdAt = 0;
    usada.lastUsed = limite + 1;
    conAlumno.lastUsed = 0;
    conAlumno.students.get("s1").lastSeen = limite + 1;
    ss.purgeOld(limite);
    expect([...ss.rooms.keys()].sort()).toEqual([conAlumno.code, usada.code].sort());
  });

  it("restaurar no pisa una sala viva con el mismo código", () => {
    const viva = ss.createRoom({ ownerId: 1 });
    expect(ss.restaurar({ id: "x", code: viva.code, name: "otra" })).toBeNull();
    expect(ss.getRoom(viva.code)).toBe(viva);
  });
});
