import { describe, it, expect } from "vitest";
import {
  limpiarTexto,
  limpiarNombre,
  nombreRepetido,
  admitirNombre,
  MENSAJES,
  nuevoSecreto,
  mismoSecreto,
  puedeReanudar,
  reanudar,
} from "./jugadores.js";

const mapa = (...nombres) => new Map(nombres.map((name, i) => [`p${i}`, { id: `p${i}`, name }]));

describe("jugadores", () => {
  it("limpia textos y nombres", () => {
    expect(limpiarTexto("  hola   mundo  ", 50)).toBe("hola mundo");
    expect(limpiarTexto(null, 5)).toBe("");
    expect(limpiarNombre("a".repeat(40))).toHaveLength(30);
  });

  it("detecta nombres repetidos sin distinguir mayúsculas", () => {
    expect(nombreRepetido(mapa("Ana"), "ANA")).toBe(true);
    expect(nombreRepetido([{ name: "Beto" }], "ana")).toBe(false);
  });

  it("admitirNombre: vacío, llena, repetido, ok", () => {
    expect(admitirNombre(mapa(), "   ").error).toBe(MENSAJES.sinNombre);
    expect(admitirNombre(mapa("Ana"), "Beto", { max: 1 }).error).toBe(MENSAJES.llena);
    expect(admitirNombre(mapa("Ana"), " ana ").error).toBe(MENSAJES.repetido);
    expect(admitirNombre(mapa("Ana"), " ana ", { unico: false })).toEqual({ nombre: "ana" });
    expect(admitirNombre(mapa("Ana"), "  Beto   Pérez ")).toEqual({ nombre: "Beto Pérez" });
  });

  it("compara secretos de forma segura", () => {
    const s = nuevoSecreto();
    expect(s.length).toBeGreaterThan(20);
    expect(mismoSecreto(s, s)).toBe(true);
    expect(mismoSecreto(s, s + "x")).toBe(false);
    expect(mismoSecreto(undefined, s)).toBe(false);
  });

  it("puedeReanudar con la misma cuenta o con la llave", () => {
    const p = { id: "a", userId: 7, secret: "llave" };
    expect(puedeReanudar(p, { userId: 7 })).toBe(true);
    expect(puedeReanudar(p, { secreto: "llave" })).toBe(true);
    expect(puedeReanudar(p, { userId: 8, secreto: "otra" })).toBe(false);
    expect(puedeReanudar({ id: "b", userId: null, secret: "k" }, { userId: null })).toBe(false);
  });

  it("reanudar por id, con o sin llave", () => {
    const jugadores = new Map([["a", { id: "a", userId: null, secret: "k" }]]);
    expect(reanudar(jugadores, {}).jugador).toBeNull();
    expect(reanudar(jugadores, { id: "zz" }).jugador).toBeNull();
    expect(reanudar(jugadores, { id: "a" }).jugador?.id).toBe("a");
    expect(reanudar(jugadores, { id: "a", exigirLlave: true })).toEqual({ jugador: null, rechazado: true });
    expect(reanudar(jugadores, { id: "a", secreto: "k", exigirLlave: true }).jugador?.id).toBe("a");
  });
});
