// ============================================================================
// EVENTOS DE SOCKET de cada juego en vivo: nombre del evento → datos que lleva.
// Mantener sincronizado con backend/server.js (Ludo) y backend/<juego>/sockets.js.
// Prefijos: Ludo sin prefijo · cw: Crucigrama · pr: Palabra · qz: Evaluación · ss: Presentaciones
// ============================================================================

type Codigo = { code: string };
/**
 * Respuesta (ack) del servidor: siempre puede traer `ok` o `error`; el resto
 * depende del evento (state, playerId, code...).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Respuesta = { ok?: boolean; error?: string } & Record<string, any>;
type Ack = (r: Respuesta) => void;
type Jugador = { code: string; playerId: string };

/** Cliente → servidor */
export interface EventosAlServidor {
  // Ludo
  "join-room": (d: Codigo) => void;
  "engineer:start-game": (d: Codigo) => void;
  "engineer:toggle-timer": (d: Codigo) => void;
  "engineer:add-time": (d: Codigo & { seconds: number }) => void;
  "engineer:reset-timer": (d: Codigo) => void;
  "engineer:skip-turn": (d: Codigo) => void;
  "engineer:end-game": (d: Codigo) => void;
  "engineer:reset-game": (d: Codigo) => void;
  "player:roll-dice": (d: Jugador & { playerKey: string }) => void;
  "team:answer": (d: Jugador & { playerKey: string; optionIndex: number }) => void;
  // Crucigrama
  "cw:watch-room": (d: Codigo, ack?: Ack) => void;
  "cw:join-room": (d: Codigo & { name: string; playerId?: string; secret?: string }, ack?: Ack) => void;
  "cw:start": (d: Codigo, ack?: Ack) => void;
  "cw:end": (d: Codigo, ack?: Ack) => void;
  "cw:reset": (d: Codigo, ack?: Ack) => void;
  "cw:submit": (d: { placementId: string; guess: string }, ack?: Ack) => void;
  "cw:sabotage": (d: { targetId: string; type: string }, ack?: Ack) => void;
  // Palabra
  "pr:watch": (d: Codigo, ack?: Ack) => void;
  "pr:join": (d: Codigo & { name: string; playerId?: string }, ack?: Ack) => void;
  "pr:leave": (d: Record<string, never>, ack?: Ack) => void;
  "pr:team": (d: { team: string }, ack?: Ack) => void;
  "pr:start": (d: Codigo, ack?: Ack) => void;
  "pr:end": (d: Codigo, ack?: Ack) => void;
  "pr:submit": (d: { word: string }, ack?: Ack) => void;
  "pr:skip": (d: Record<string, never>, ack?: Ack) => void;
  "pr:typing": (d: { text: string }) => void;
  // Evaluación rápida
  "qz:watch": (d: Codigo, ack?: Ack) => void;
  "qz:join": (d: Codigo & { name: string; playerId?: string }, ack?: Ack) => void;
  "qz:start": (d: Codigo, ack?: Ack) => void;
  "qz:next": (d: Codigo, ack?: Ack) => void;
  "qz:reveal": (d: Codigo, ack?: Ack) => void;
  "qz:end": (d: Codigo, ack?: Ack) => void;
  "qz:export": (d: Codigo, ack?: Ack) => void;
  "qz:answer": (d: { choice: number }, ack?: Ack) => void;
  // Presentaciones
  "ss:watch": (d: Codigo, ack?: Ack) => void;
  "ss:join": (d: Codigo & { studentId?: string; name: string; team?: string; teamCode?: string }, ack?: Ack) => void;
  "ss:op": (d: { op: Record<string, unknown> }, ack?: Ack) => void;
  "ss:view": (d: { slideId: string }) => void;
  "ss:comment": (d: Codigo & { key: string; sid: string; text: string }, ack?: Ack) => void;
  "ss:lock": (d: Codigo & { locked: boolean }, ack?: Ack) => void;
  "ss:reopen": (d: Codigo, ack?: Ack) => void;
  "ss:close": (d: Codigo, ack?: Ack) => void;
}

/** Servidor → cliente */
export interface EventosDelServidor {
  // Ludo
  state: (s: Record<string, unknown>) => void;
  timer: (segundos: number) => void;
  "phase-timer": (d: { seconds: number }) => void;
  "error-message": (mensaje: string) => void;
  // Crucigrama
  "cw:state": (s: Record<string, unknown>) => void;
  "cw:sabotage-used": (d: Record<string, unknown>) => void;
  // Palabra
  "pr:state": (s: Record<string, unknown>) => void;
  "pr:typing": (d: { n: number; text: string }) => void;
  // Evaluación rápida
  "qz:state": (s: Record<string, unknown>) => void;
  // Presentaciones
  "ss:student": (d: Record<string, unknown>) => void;
  "ss:op": (d: Record<string, unknown>) => void;
  "ss:presence": (d: Record<string, unknown>) => void;
  "ss:members": (d: Record<string, unknown>) => void;
  "ss:comment": (d: Record<string, unknown>) => void;
  "ss:room": (d: Record<string, unknown>) => void;
}
