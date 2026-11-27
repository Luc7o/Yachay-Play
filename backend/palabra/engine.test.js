import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as p from "./engine.js";
import { checkWord, normalizeWord } from "./diccionario.js";

const sala = (extra = {}) => p.createRoom({ name: "Prueba", ownerId: 1, ownerName: "Profe", ...extra });
const conJugadores = (room, ...nombres) => nombres.map((name) => p.addPlayer(room, { name }).player);
// El fragmento sale al azar: para que la prueba sea fija lo ponemos a mano.
const fijarFragmento = (room, f) => (room.turn.fragment = f);

describe("Palabra relámpago: motor", () => {
  beforeEach(() => {
    p.rooms.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("crea salas con código único y ajustes dentro de los límites", () => {
    const a = sala({ seconds: 999, maxRounds: 1, mode: "otro" });
    const b = sala({ mode: "equipos", teams: 9 });
    expect(a.code).toMatch(/^\d{6}$/);
    expect(a.code).not.toBe(b.code);
    expect(p.getRoom(` ${a.code} `)).toBe(a);
    expect(a.seconds).toBe(p.LIMITS.maxSeconds);
    expect(a.maxRounds).toBe(p.LIMITS.minRounds);
    expect(a.mode).toBe("individual");
    expect(b.entities).toHaveLength(p.LIMITS.maxTeams);
    expect(p.openRoomsOf(1)).toBe(2);
  });

  it("solo acepta palabras extra seguras", () => {
    const room = sala({ extraWords: ["Ñandú", "x", "con espacio", "ok1", "quinua"] });
    expect([...room.extra]).toEqual(["ñandu", "quinua"]);
  });

  it("jugadores: nombre, duplicados, cupo, reanudar y solo en la sala de espera", () => {
    const room = sala();
    const [ana] = conJugadores(room, "Ana");
    expect(p.addPlayer(room, { name: "ANA" }).error).toMatch(/nombre/);
    expect(p.addPlayer(room, { name: " " }).error).toMatch(/nombre/);
    expect(p.addPlayer(room, { id: ana.id }).player).toBe(ana);
    for (let i = 1; i < p.LIMITS.maxPlayers; i++) p.addPlayer(room, { name: `J${i}` });
    expect(p.addPlayer(room, { name: "" }).error).toMatch(/llena/); // la sala llena va primero
    const otra = sala();
    conJugadores(otra, "A", "B");
    p.start(otra);
    expect(p.addPlayer(otra, { name: "C" }).error).toMatch(/ya empezó/);
  });

  it("necesita al menos 2 participantes para empezar", () => {
    const room = sala();
    conJugadores(room, "Ana");
    expect(p.start(room).error).toMatch(/2 jugadores/);
    conJugadores(room, "Beto");
    expect(p.start(room).ok).toBe(true);
    expect(room.status).toBe("turn");
    expect(p.start(room).error).toBeTruthy();
  });

  it("valida la palabra en el servidor y suma 10 + segundos que sobraban", () => {
    const room = sala({ seconds: 20 });
    const [ana, beto] = conJugadores(room, "Ana", "Beto");
    p.start(room);
    fijarFragmento(room, "sa");
    expect(p.submit(room, beto.id, "casa").error).toMatch(/No es tu turno/);
    expect(p.submit(room, ana.id, "luna").error).toMatch(/SA/);
    expect(p.submit(room, ana.id, "sasasa").error).toMatch(/diccionario/);
    vi.advanceTimersByTime(5000);
    expect(p.submit(room, ana.id, "Casa").ok).toBe(true);
    expect(room.status).toBe("result");
    expect(room.entities[0].score).toBe(10 + 15);
    expect(room.used.has("casa")).toBe(true);
    expect(checkWord("casa", "sa", room.used, room.extra)).toMatch(/utilizada/);
  });

  it("acepta las palabras extra del docente", () => {
    const room = sala({ extraWords: ["quinua"] });
    const [ana] = conJugadores(room, "Ana", "Beto");
    p.start(room);
    fijarFragmento(room, "qu");
    expect(p.submit(room, ana.id, "quinua").ok).toBe(true);
    expect(normalizeWord("QUÍNUA")).toBe("quinua");
  });

  it("el reloj quita una vida al vencer el turno y pasa al siguiente", () => {
    const room = sala({ seconds: 10 });
    const [ana, beto] = conJugadores(room, "Ana", "Beto");
    p.start(room);
    expect(room.turn.playerId).toBe(ana.id);
    vi.advanceTimersByTime(10_000);
    p.tick(room);
    expect(room.status).toBe("result");
    expect(room.lastResult).toMatchObject({ ok: false, reason: "time", playerName: "Ana" });
    expect(room.entities[0].lives).toBe(p.LIVES - 1);
    vi.advanceTimersByTime(2000);
    p.tick(room);
    expect(room.status).toBe("turn");
    expect(room.turn.playerId).toBe(beto.id);
    expect(room.round).toBe(2);
  });

  it("quien se queda sin vidas sale y la partida termina con 1 en pie", () => {
    const room = sala();
    const [ana, beto] = conJugadores(room, "Ana", "Beto");
    p.start(room);
    const pasarTurno = () => {
      p.skip(room, room.turn.playerId);
      vi.advanceTimersByTime(2000);
      p.tick(room);
    };
    // Ana pasa siempre; Beto también, pero Ana empieza y pierde su tercera vida antes.
    for (let i = 0; i < 2 * p.LIVES - 1; i++) pasarTurno();
    expect(room.status).toBe("ended");
    const [primero] = p.publicState(room).ranking;
    expect(primero.name).toBe("Beto");
    expect(room.entities.find((e) => e.id === ana.id).lives).toBe(0);
    expect(room.entities.find((e) => e.id === beto.id).lives).toBe(1);
  });

  it("equipos: quien no eligió va al equipo con menos integrantes y se turnan", () => {
    const room = sala({ mode: "equipos", teams: 2 });
    const [ana, beto, caro] = conJugadores(room, "Ana", "Beto", "Caro");
    expect(p.setTeam(room, ana.id, "t0").ok).toBe(true);
    expect(p.setTeam(room, beto.id, "t0").ok).toBe(true);
    expect(p.setTeam(room, caro.id, "nope").error).toMatch(/no existe/);
    p.start(room);
    expect(caro.team).toBe("t1");
    expect(room.turn.playerId).toBe(ana.id);
    p.skip(room, ana.id);
    vi.advanceTimersByTime(2000);
    p.tick(room);
    expect(room.turn.playerId).toBe(caro.id);
    p.skip(room, caro.id);
    vi.advanceTimersByTime(2000);
    p.tick(room);
    expect(room.turn.playerId).toBe(beto.id); // el equipo t0 responde con otro integrante
  });

  it("muestra lo que se escribe solo de quien tiene el turno y purga salas viejas", () => {
    const room = sala();
    const [ana, beto] = conJugadores(room, "Ana", "Beto");
    p.start(room);
    expect(p.setTyping(room, beto.id, "hola")).toBe(false);
    expect(p.setTyping(room, ana.id, "ho")).toBe(true);
    expect(p.publicState(room, ana.id, false).turn.typing).toBe("ho");
    expect(p.publicState(room, ana.id, false).me.name).toBe("Ana");
    expect(p.end(room).ok).toBe(true);
    expect(p.end(room).error).toBeTruthy();
    p.purgeOldRooms(Date.now() + 1);
    expect(p.getRoom(room.code)).toBeNull();
  });
});
