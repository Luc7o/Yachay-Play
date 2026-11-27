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
});
