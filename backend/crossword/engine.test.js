import { describe, it, expect, beforeEach } from "vitest";
import * as cw from "./engine.js";

const T0 = 1_000_000;
const nueva = (extra = {}) => cw.createRoom({ name: "Prueba", ownerId: 1, minutes: 5, wordCount: 8, ...extra });
const unir = (room, id, name, userId = null) => cw.addPlayer(room, { id, name, userId }).player;
const palabras = (room) => room.grid.placements;

describe("Crucigrama relámpago: motor", () => {
  beforeEach(() => cw.rooms.clear());

  it("crea la sala con código único, en la sala de espera", () => {
    const a = nueva();
    const b = nueva();
    expect(a.code).toMatch(/^\d{6}$/);
    expect(a.code).not.toBe(b.code);
    expect(cw.getRoom(` ${a.code} `)).toBe(a);
    expect(a.status).toBe("lobby");
    expect(palabras(a).length).toBeGreaterThan(0);
  });

  it("agrega jugadores con nombre limpio y una llave privada", () => {
    const room = nueva();
    expect(cw.addPlayer(room, { id: "x", name: "   " }).error).toBeTruthy();
    const ana = unir(room, "a", "  Ana   María ");
    expect(ana.name).toBe("Ana María");
    expect(ana.secret.length).toBeGreaterThan(20);
    expect(unir(room, "a", "Otro nombre")).toBe(ana); // mismo id: el mismo jugador
  });

  it("no empieza sin jugadores ni dos veces", () => {
    const room = nueva();
    expect(cw.startRoom(room, T0).error).toMatch(/Nadie/);
    unir(room, "a", "Ana");
    expect(cw.startRoom(room, T0).ok).toBe(true);
    expect(room.endsAt).toBe(T0 + 5 * 60 * 1000);
    expect(cw.startRoom(room, T0).error).toBeTruthy();
  });

  it("acierto suma puntos y energía; fallo pone espera y corta la racha", () => {
    const room = nueva();
    unir(room, "a", "Ana");
    cw.startRoom(room, T0);
    const [p1, p2] = palabras(room);
    const mal = cw.submitAnswer(room, "a", p1.id, "zzz", T0 + 10);
    expect(mal).toMatchObject({ ok: true, correct: false });
    expect(cw.submitAnswer(room, "a", p1.id, p1.word, T0 + 20).error).toBe("espera");
    const bien = cw.submitAnswer(room, "a", p1.id, p1.word.toLowerCase(), T0 + 4000);
    expect(bien).toMatchObject({ ok: true, correct: true, streak: 1, points: 100 + p1.length * 5 });
    expect(cw.submitAnswer(room, "a", p1.id, p1.word, T0 + 4100).error).toMatch(/Ya resolviste/);
    const racha = cw.submitAnswer(room, "a", p2.id, p2.word, T0 + 4200);
    expect(racha.points).toBe(100 + p2.length * 5 + 10);
    expect(racha.energy).toBe(20 + 25);
  });

  it("quien completa todo primero gana y la partida se cierra", () => {
    const room = nueva();
    unir(room, "a", "Ana");
    unir(room, "b", "Beto");
    cw.startRoom(room, T0);
    let ultimo;
    for (const p of palabras(room)) ultimo = cw.submitAnswer(room, "a", p.id, p.word, T0 + 100);
    expect(ultimo).toMatchObject({ completedAll: true, finishRank: 1, finishBonus: 250 });
    expect(room.status).toBe("ended");
    expect(room.endReason).toBe("completed");
    expect(room.winnerId).toBe("a");
    expect(cw.submitAnswer(room, "b", palabras(room)[0].id, "x", T0 + 200).error).toMatch(/no está en curso/);
  });

  it("al acabarse el tiempo gana quien tiene más puntos (o nadie)", () => {
    const room = nueva();
    unir(room, "a", "Ana");
    unir(room, "b", "Beto");
    cw.startRoom(room, T0);
    const [p1] = palabras(room);
    cw.submitAnswer(room, "b", p1.id, p1.word, T0 + 100);
    cw.tick(room, room.endsAt);
    expect(room).toMatchObject({ status: "ended", endReason: "time", winnerId: "b" });

    const vacia = nueva();
    unir(vacia, "a", "Ana");
    cw.startRoom(vacia, T0);
    cw.endRoom(vacia);
    expect(vacia).toMatchObject({ status: "ended", endReason: "teacher", winnerId: null });
  });

  it("sabotajes: cuestan energía, congelan, nublan y roban", () => {
    const room = nueva();
    const ana = unir(room, "a", "Ana");
    const beto = unir(room, "b", "Beto");
    cw.startRoom(room, T0);
    expect(cw.useSabotage(room, "a", "a", "freeze", T0).error).toMatch(/ti mismo/);
    expect(cw.useSabotage(room, "a", "b", "toString", T0).error).toMatch(/no existe/);
    expect(cw.useSabotage(room, "a", "b", "freeze", T0).error).toMatch(/energía/);

    ana.energy = 100;
    beto.score = 30;
    const f = cw.useSabotage(room, "a", "b", "freeze", T0);
    expect(f.until).toBe(T0 + cw.SABOTAGES.freeze.durationMs);
    expect(cw.submitAnswer(room, "b", palabras(room)[0].id, "x", T0 + 1).error).toBe("congelado");
    expect(cw.useSabotage(room, "a", "b", "fog", T0).until).toBe(T0 + cw.SABOTAGES.fog.durationMs);
    ana.energy = 100;
    expect(cw.useSabotage(room, "a", "b", "steal", T0).stolen).toBe(30); // no roba más de lo que tiene
    expect(beto.score).toBe(0);
    expect(ana.score).toBe(30);
    expect(room.log.some((l) => l.type === "sabotage")).toBe(true);
  });

  it("el estado público nunca trae las respuestas de rivales", () => {
    const room = nueva();
    unir(room, "a", "Ana");
    unir(room, "b", "Beto");
    cw.startRoom(room, T0);
    const [p1] = palabras(room);
    cw.submitAnswer(room, "a", p1.id, p1.word, T0 + 100);
    const deBeto = cw.publicRoomState(room, "b", T0 + 200);
    expect(deBeto.clues.every((c) => !("word" in c))).toBe(true);
    expect(deBeto.clues.find((c) => c.id === p1.id).revealedWord).toBeUndefined();
    expect(deBeto.me.solvedWords).toEqual([]);
    expect(cw.publicRoomState(room, "a", T0 + 200).me.solvedWords).toEqual([{ placementId: p1.id, word: p1.word }]);
    expect(deBeto.leaderboard[0]).toMatchObject({ id: "a", progress: expect.any(Number) });

    cw.submitAnswer(room, "b", p1.id, p1.word, T0 + 300); // ya la saben todos: se puede mostrar
    expect(cw.publicRoomState(room, "b", T0 + 400).clues.find((c) => c.id === p1.id).revealedWord).toBe(p1.word);
  });

  it("reinicia con el mismo código, restaura salas y purga las viejas", () => {
    const room = nueva();
    const ana = unir(room, "a", "Ana");
    cw.startRoom(room, T0);
    cw.submitAnswer(room, "a", palabras(room)[0].id, palabras(room)[0].word, T0 + 100);
    expect(cw.resetRoom(room).ok).toBe(true);
    expect(room.status).toBe("lobby");
    expect(ana.score).toBe(0);
    expect(ana.solved.size).toBe(0);

    const restaurada = cw.restoreRoom({
      id: "r1",
      code: "123456",
      name: "Vieja",
      ownerId: 1,
      minutes: 3,
      grid: room.grid,
      players: [{ id: "z", name: "Zoe", userId: 9 }],
    });
    expect(cw.getRoom("123456")).toBe(restaurada);
    expect(restaurada.players.get("z").name).toBe("Zoe");
    expect(cw.restoreRoom({ code: "123456" })).toBe(restaurada); // no la duplica

    cw.purgeOldRooms(Date.now() + 1);
    expect(cw.rooms.size).toBe(0);
  });
});
