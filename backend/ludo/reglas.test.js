import { describe, it, expect } from "vitest";
import {
  TEAM_COLORS,
  PUNTOS_POR_ACIERTO,
  setPhase,
  eligibleTeams,
  siguienteEquipo,
  movePiece,
  aplicarRespuesta,
  pasoDelReloj,
} from "./reglas.js";
import { GOAL_STEP, SAFE_INDEXES, ringIndexForStep, START_INDEX } from "../board.js";

const pregunta = { id: 7, topic: "Suma", options: ["3", "4", "5"], answerIndex: 1 };
const partida = (extra = {}) => ({
  phase: "playing",
  turnPhase: "question",
  phaseSecondsLeft: 20,
  activeTeams: ["rojo", "azul"],
  currentTeamIndex: 0,
  turnCounter: 1,
  timerRunning: false,
  timerSeconds: 600,
  teams: Object.fromEntries(TEAM_COLORS.map((c) => [c, { id: c, score: 0, correct: 0, incorrect: 0 }])),
  players: [
    { id: "r1", name: "Rita", team: "rojo" },
    { id: "a1", name: "Ariel", team: "azul" },
  ],
  positions: { r1: -1, a1: -1 },
  history: [],
  currentQuestion: pregunta,
  lastDice: 3,
  ...extra,
});

describe("Ludo: fases y equipos", () => {
  it("setPhase solo espera respuesta en la fase de pregunta", () => {
    const g = partida();
    setPhase(g, "roll", 15);
    expect(g).toMatchObject({ turnPhase: "roll", phaseSecondsLeft: 15, awaitingAnswer: false });
    setPhase(g, "question", 20);
    expect(g.awaitingAnswer).toBe(true);
  });

  it("solo juegan los equipos activos con alumnos (o todos si no hay nadie)", () => {
    expect(eligibleTeams(partida({ activeTeams: ["rojo", "verde", "azul"] }))).toEqual(["rojo", "azul"]);
    expect(eligibleTeams(partida({ players: [] }))).toEqual(["rojo", "azul"]);
  });

  it("el turno pasa al siguiente color que puede jugar, dando la vuelta", () => {
    const g = partida({ activeTeams: ["rojo", "verde", "azul"] });
    expect(TEAM_COLORS[siguienteEquipo(g)]).toBe("azul"); // verde no tiene alumnos: se salta
    g.currentTeamIndex = TEAM_COLORS.indexOf("azul");
    expect(TEAM_COLORS[siguienteEquipo(g)]).toBe("rojo");
  });
});

describe("Ludo: movimiento de la ficha", () => {
  it("sale de casa contando desde la salida y necesita el número exacto para la meta", () => {
    const g = partida();
    expect(movePiece(g, "r1", "rojo", 6)).toMatchObject({ moved: true, from: -1, to: 5 });
    g.positions.r1 = GOAL_STEP - 2;
    expect(movePiece(g, "r1", "rojo", 3)).toMatchObject({ moved: false, to: GOAL_STEP - 2 });
    expect(movePiece(g, "r1", "rojo", 2)).toMatchObject({ moved: true, reachedGoal: true });
  });

  it("come la ficha rival fuera de casillas seguras, pero no en las seguras", () => {
    // Busca un paso de rojo que caiga en una casilla NO segura y pone a azul ahí.
    let paso = 1;
    while (SAFE_INDEXES.includes(ringIndexForStep("rojo", paso + 3))) paso++;
    const destino = ringIndexForStep("rojo", paso + 3);
    const pasoAzul = (destino - START_INDEX.azul + 52) % 52;
    expect(ringIndexForStep("azul", pasoAzul)).toBe(destino);

    const g = partida({ positions: { r1: paso, a1: pasoAzul } });
    expect(movePiece(g, "r1", "rojo", 3).captured).toEqual(["Ariel"]);
    expect(g.positions.a1).toBe(-1);

    // En la salida de rojo (casilla segura) no se come a nadie.
    const segura = partida({ positions: { r1: -1, a1: (START_INDEX.rojo - START_INDEX.azul + 52) % 52 } });
    expect(movePiece(segura, "r1", "rojo", 1).captured).toEqual([]);
  });
});

describe("Ludo: resolver la respuesta", () => {
  it("acierto: suma puntos, avanza la ficha y anota el historial", () => {
    const g = partida();
    const r = aplicarRespuesta(g, "rojo", "r1", 1);
    expect(r).toMatchObject({ isCorrect: true, timedOut: false, pointsEarned: PUNTOS_POR_ACIERTO });
    expect(g.teams.rojo).toMatchObject({ score: PUNTOS_POR_ACIERTO, correct: 1 });
    expect(g.positions.r1).toBe(2); // dado 3 desde casa
    expect(g.lastResult).toMatchObject({ team: "rojo", correctText: "4", playerName: "Rita", selectedIndex: 1 });
    expect(g.history[0]).toMatchObject({ turn: 1, dice: 3, topic: "Suma", correct: true, from: -1, to: 2 });
  });

  it("fallo o tiempo agotado: no suma ni mueve", () => {
    const g = partida();
    expect(aplicarRespuesta(g, "rojo", "r1", 0)).toMatchObject({ isCorrect: false, move: null });
    const t = aplicarRespuesta(g, "rojo", null, null);
    expect(t).toMatchObject({ isCorrect: false, timedOut: true });
    expect(g.teams.rojo).toMatchObject({ score: 0, incorrect: 2 });
    expect(g.lastResult).toMatchObject({ timedOut: true, selectedIndex: null, playerName: null });
    expect(g.positions.r1).toBe(-1);
  });

  it("la nota del equipo no pasa de 20", () => {
    const g = partida();
    g.teams.rojo.score = 19.5;
    aplicarRespuesta(g, "rojo", "r1", 1);
    expect(g.teams.rojo.score).toBe(20);
  });
});

describe("Ludo: el reloj", () => {
  it("cuenta la fase y avisa cuál venció", () => {
    const g = partida({ turnPhase: "roll", phaseSecondsLeft: 2 });
    expect(pasoDelReloj(g)).toEqual({ fase: { turnPhase: "roll", seconds: 1 } });
    expect(pasoDelReloj(g)).toEqual({ fase: { turnPhase: "roll", seconds: 0 }, vencio: "roll" });
  });

  it("el cronómetro general termina la partida al llegar a 0", () => {
    const g = partida({ timerRunning: true, timerSeconds: 2 });
    expect(pasoDelReloj(g).timer).toBe(1);
    expect(pasoDelReloj(g)).toEqual({ timer: 0, terminoPorTiempo: true });
    expect(g).toMatchObject({ phase: "finished", timerRunning: false, currentQuestion: null });
  });

  it("fuera de juego no corre la fase", () => {
    const g = partida({ phase: "lobby", phaseSecondsLeft: 5 });
    expect(pasoDelReloj(g)).toEqual({});
    expect(g.phaseSecondsLeft).toBe(5);
  });
});
