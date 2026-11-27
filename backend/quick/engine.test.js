import { describe, it, expect, beforeEach, vi } from "vitest";
import * as q from "./engine.js";

const preguntas = () =>
  q.sanitizeQuestions([
    { text: "¿2+2?", options: ["3", "4"], correct: 1, seconds: 10 },
    { text: "¿Capital del Perú?", options: ["Lima", "Cusco", "Puno"], correct: 0, seconds: 10 },
  ]).questions;

describe("Evaluación rápida: motor", () => {
  beforeEach(() => {
    q.rooms.clear();
    vi.useRealTimers();
  });

  it("valida las preguntas", () => {
    expect(q.sanitizeQuestions([]).error).toBeTruthy();
    expect(q.sanitizeQuestions([{ text: "x", options: ["a", "a"], correct: 0 }]).error).toMatch(/repetidas/);
    expect(q.sanitizeQuestions([{ text: "x", options: ["a", "b"], correct: 5 }]).error).toMatch(/correcta/);
    const { questions } = q.sanitizeQuestions([{ text: "x", options: ["a", "b"], correct: 0, seconds: 9999 }]);
    expect(questions[0].seconds).toBe(q.LIMITS.maxSeconds);
  });

  it("crea salas con código de 6 dígitos único", () => {
    const a = q.createRoom({ name: "A", ownerId: 1, questions: preguntas() });
    const b = q.createRoom({ name: "B", ownerId: 1, questions: preguntas() });
    expect(a.code).toMatch(/^\d{6}$/);
    expect(a.code).not.toBe(b.code);
    expect(q.getRoom(` ${a.code} `)).toBe(a);
  });

  it("no deja entrar con nombre repetido ni sin nombre", () => {
    const sala = q.createRoom({ ownerId: 1, questions: preguntas() });
    expect(q.addPlayer(sala, { name: "Ana" }).player).toBeTruthy();
    expect(q.addPlayer(sala, { name: " ana " }).error).toMatch(/nombre/);
    expect(q.addPlayer(sala, { name: "  " }).error).toBeTruthy();
  });

  it("puntúa: correcta y rápida vale más; incorrecta vale 0", () => {
    vi.useFakeTimers();
    const sala = q.createRoom({ ownerId: 1, questions: preguntas() });
    const ana = q.addPlayer(sala, { name: "Ana" }).player;
    const beto = q.addPlayer(sala, { name: "Beto" }).player;
    expect(q.start(sala).ok).toBe(true);
    q.answer(sala, ana.id, 1); // correcta al instante
    vi.advanceTimersByTime(5000);
    q.answer(sala, beto.id, 0); // incorrecta
    q.tick(sala); // ya respondieron todos -> se cierra
    expect(sala.status).toBe("reveal");
    expect(ana.score).toBe(150);
    expect(beto.score).toBe(0);
  });

  it("recorre las preguntas y termina", () => {
    const sala = q.createRoom({ ownerId: 1, questions: preguntas() });
    q.addPlayer(sala, { name: "Ana" });
    q.start(sala);
    expect(q.next(sala).ok).toBe(true);
    expect(sala.qIndex).toBe(1);
    expect(q.next(sala).ended).toBe(true);
    expect(sala.status).toBe("ended");
    expect(q.end(sala).error).toBeTruthy();
  });

  it("reanuda por id y no deja entrar a una evaluación terminada", () => {
    const sala = q.createRoom({ ownerId: 1, questions: preguntas() });
    const ana = q.addPlayer(sala, { name: "Ana" }).player;
    expect(q.addPlayer(sala, { id: ana.id }).player).toBe(ana); // recargó la página
    q.start(sala);
    q.end(sala);
    expect(q.addPlayer(sala, { id: ana.id }).player).toBe(ana);
    expect(q.addPlayer(sala, { name: "Beto" }).error).toMatch(/terminó/);
    expect(q.addPlayer(sala, { name: "" }).error).toMatch(/nombre/); // primero se pide el nombre
  });

  it("respeta el cupo de la sala", () => {
    const sala = q.createRoom({ ownerId: 1, questions: preguntas() });
    for (let i = 0; i < q.LIMITS.maxPlayers; i++) q.addPlayer(sala, { name: `E${i}` });
    expect(q.addPlayer(sala, { name: "Uno más" }).error).toMatch(/llena/);
  });

  it("no revela la respuesta correcta al estudiante con la pregunta abierta", () => {
    const sala = q.createRoom({ ownerId: 1, questions: preguntas() });
    const ana = q.addPlayer(sala, { name: "Ana" }).player;
    q.start(sala);
    expect(q.publicState(sala, ana.id).question.correct).toBeUndefined();
    expect(q.publicState(sala, ana.id).counts).toBeUndefined();
    expect(q.publicState(sala, null, true).question.correct).toBe(1);
    q.reveal(sala);
    expect(q.publicState(sala, ana.id).question.correct).toBe(1);
  });

  it("rechaza respuestas fuera de tiempo, repetidas o inválidas", () => {
    vi.useFakeTimers();
    const sala = q.createRoom({ ownerId: 1, questions: preguntas() });
    const ana = q.addPlayer(sala, { name: "Ana" }).player;
    const beto = q.addPlayer(sala, { name: "Beto" }).player;
    expect(q.answer(sala, ana.id, 0).error).toMatch(/abierta/);
    q.start(sala);
    expect(q.answer(sala, ana.id, 9).error).toMatch(/inválida/);
    expect(q.answer(sala, "nadie", 0).error).toBeTruthy();
    expect(q.answer(sala, ana.id, 1).ok).toBe(true);
    expect(q.answer(sala, ana.id, 0).error).toMatch(/Ya respondiste/);
    vi.advanceTimersByTime(11_000);
    expect(q.answer(sala, beto.id, 1).error).toMatch(/tiempo/);
    q.tick(sala); // se acabó el tiempo -> se cierra aunque falte Beto
    expect(sala.status).toBe("reveal");
  });

  it("exporta una fila por estudiante y purga las salas viejas", () => {
    const sala = q.createRoom({ ownerId: 1, questions: preguntas() });
    const ana = q.addPlayer(sala, { name: "Ana" }).player;
    q.start(sala);
    q.answer(sala, ana.id, 1);
    q.end(sala);
    const filas = q.exportRows(sala);
    expect(filas[0]).toEqual(["Estudiante", "Puntaje", "Aciertos", "P1", "P2"]);
    expect(filas[1].slice(0, 1).concat(filas[1].slice(3))).toEqual(["Ana", "✔", "—"]);
    q.purgeOldRooms(Date.now() + 1);
    expect(q.getRoom(sala.code)).toBeNull();
  });
});
