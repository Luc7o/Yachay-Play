// ============================================================================
// TIPOS COMPARTIDOS: lo que la API del backend responde y el frontend consume.
// ----------------------------------------------------------------------------
// El frontend los importa en TypeScript (frontend/src/api.ts). El backend sigue
// en JavaScript y los usa con JSDoc (`@type {import("../shared/types/api").X}`)
// en los archivos marcados con // @ts-check. Si cambias una respuesta del
// servidor, cambia aquí su tipo: `npm run typecheck` avisa a quien la use.
// ============================================================================

export type Rol = "docente" | "estudiante";

/** Usuario público (backend/authCore.js → publicUser). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Rol;
  twoFactorEnabled: boolean;
  hasPassword: boolean;
  emailVerified: boolean;
}

/** Login, registro, Google y 2FA. */
export interface AuthOk {
  token: string;
  user: PublicUser;
}
/** Login de una cuenta con 2FA: falta el segundo paso. */
export interface AuthNecesita2FA {
  needs2FA: true;
  challenge: string;
}

// ---------------------------- Clases ----------------------------
export type TipoActividad = "ludo" | "crucigrama" | "palabra" | "evaluacion" | "estudio";

/** Actividad en vivo de una clase (backend/classes/routes.js → actividadPublica). */
export interface ActividadEnVivo {
  kind: TipoActividad;
  code: string;
  name: string;
  status: string;
  players: number;
}
export interface ClaseDocente {
  id: string;
  name: string;
  section: string;
  code: string;
  members: number;
  activities: number;
  createdAt: string;
  live: ActividadEnVivo[];
}
export interface ClaseEstudiante {
  id: string;
  name: string;
  section: string;
  teacher: string;
  joinedAt: string;
  live: ActividadEnVivo[];
}
export interface ClaseDetalle {
  id: string;
  name: string;
  section: string;
  teacher: string;
  role: "owner" | "member";
  live: ActividadEnVivo[];
  history: { kind: TipoActividad; name: string; createdAt: string; players: number; status: string }[];
  /** Solo para el docente dueño de la clase. */
  code?: string;
  members?: { id: string; name: string; joinedAt: string }[];
}

// ---------------------------- Estadísticas ----------------------------
export type ColorLudo = "rojo" | "verde" | "amarillo" | "azul";

export interface StatsDocente {
  role: "docente";
  ludo: {
    total: number;
    finished: number;
    players: number;
    winsByColor: Partial<Record<ColorLudo, number>>;
    recent: {
      code: string;
      name: string;
      created_at: string;
      players: number;
      phase: string;
      winner_team: ColorLudo | null;
      end_reason: string | null;
    }[];
    hardQuestions: { id: string; question: string; topic: string; asked: number; correct: number; pct: number }[];
  };
  crossword: {
    total: number;
    finished: number;
    players: number;
    recent: {
      code: string;
      name: string;
      created_at: string;
      players: number;
      status: string;
      winner: string | null;
      end_reason: string | null;
    }[];
    top: { name: string; games: number; best: number }[];
  };
}
export interface StatsEstudiante {
  role: "estudiante";
  summary: { played: number; won: number; correct: number; incorrect: number };
  ludo: {
    code: string;
    name: string;
    created_at: string;
    team: ColorLudo;
    phase: string;
    winner_team: ColorLudo | null;
    correct: number;
    incorrect: number;
  }[];
  crossword: {
    code: string;
    name: string;
    created_at: string;
    status: string;
    won: boolean;
    score: number;
    solved_count: number;
  }[];
}
export type Stats = StatsDocente | StatsEstudiante;

// ---------------------------- Perfil ----------------------------
export interface Logro {
  id: string;
  icon: string;
  name: string;
  desc: string;
  unlocked: boolean;
}
export interface Perfil {
  user: PublicUser & { created_at: string };
  docente?: { ludoGames: number; crosswordGames: number; questions: number; students: number };
  estudiante?: {
    played: number;
    won: number;
    correct: number;
    incorrect: number;
    points: number;
    rank: number | null;
    totalRanked: number;
    badges: Logro[];
  };
}
export interface FilaRanking {
  position: number;
  name: string;
  won: number;
  played: number;
  points: number;
  me?: boolean;
}
export interface Ranking {
  total: number;
  top: FilaRanking[];
  me: FilaRanking | null;
}
