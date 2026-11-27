import { conClaseDestino, limpiarClaseDestino } from "./claseDestino";
import type {
  AuthNecesita2FA,
  AuthOk,
  ClaseDetalle,
  ClaseDocente,
  ClaseEstudiante,
  Perfil,
  PublicUser,
  Ranking,
  Rol,
  Stats,
} from "../../shared/types/api";

/** Error de la API: el mensaje para mostrar y el código HTTP. */
export type ErrorApi = Error & { status?: number };
type Msg = { message: string };
type Ok = { ok: true };
/** Respuestas que todavía no tienen tipo propio en shared/types/api.ts. */
type SinTipo = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Al crear una partida con éxito se olvida la "clase destino" (ver claseDestino.js).
const olvidarDestino = <T>(r: T): T => {
  limpiarClaseDestino();
  return r;
};

const API_URL: string = import.meta.env.VITE_API_URL || "http://localhost:4000";

// --- Sesión: el token se guarda en el navegador para no volver a iniciar sesión ---
const TOKEN_KEY = "yachay_token";
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* modo privado: la sesión durará solo mientras la pestaña esté abierta */
  }
}

async function request<T = SinTipo>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa que el backend esté encendido.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Si el servidor no explicó el error (por ejemplo, responde con una página HTML), lo deducimos del código
    const porCodigo =
      res.status === 404
        ? "El servidor no reconoce esta acción: parece una versión anterior. Detén el backend (Ctrl+C) y vuelve a iniciarlo con npm start."
        : res.status >= 500
          ? "El servidor tuvo un problema interno. Revisa la consola del backend."
          : "No se pudo completar la acción. Inténtalo de nuevo.";
    const err: ErrorApi = new Error(data.error || porCodigo);
    err.status = res.status;
    throw err;
  }
  return data as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const id = encodeURIComponent;

export const api = {
  // Cuentas
  register: (d: {
    name: string;
    email: string;
    password: string;
    role: Rol;
    acceptTerms: boolean;
    confirmAge: boolean;
  }) => request<AuthOk>("/api/auth/register", post(d)),
  login: (email: string, password: string) =>
    request<AuthOk | AuthNecesita2FA>("/api/auth/login", post({ email, password })),
  login2fa: (challenge: string, code: string) => request<AuthOk>("/api/auth/login/2fa", post({ challenge, code })),
  google: (credential: string, role: Rol | undefined, acceptTerms?: boolean, confirmAge?: boolean) =>
    request<AuthOk | AuthNecesita2FA | { needsRole: true; email: string; name: string }>(
      "/api/auth/google",
      post({ credential, role, acceptTerms, confirmAge }),
    ),
  forgotPassword: (email: string) => request<Msg>("/api/auth/forgot", post({ email })),
  resetPassword: (token: string, password: string) => request<Msg>("/api/auth/reset", post({ token, password })),
  verifyEmail: (token: string) => request<Msg>("/api/auth/verify-email", post({ token })),
  resendVerification: () => request<Msg>("/api/auth/resend-verification", post({})),
  logoutAll: () => request<{ token?: string }>("/api/auth/logout-all", post({})),
  twoFactorSetup: (password?: string) =>
    request<{ secret: string; qr?: string }>("/api/auth/2fa/setup", post({ password })),
  twoFactorEnable: (code: string) =>
    request<{ user: PublicUser; recoveryCodes: string[] }>("/api/auth/2fa/enable", post({ code })),
  twoFactorDisable: (code: string, password?: string) =>
    request<{ user: PublicUser }>("/api/auth/2fa/disable", post({ code, password })),
  twoFactorNewCodes: (code: string) =>
    request<{ recoveryCodes: string[] }>("/api/auth/2fa/recovery-codes", post({ code })),
  me: () => request<{ user: PublicUser }>("/api/auth/me"),
  demoAccounts: () => request("/api/auth/demo"),
  assistantChat: (messages: { role: "user" | "assistant"; content: string }[]) =>
    request<{ reply: string }>("/api/assistant/chat", post({ messages })),
  // Partidas
  createGame: (name: string, counts: Record<string, number>, config: Record<string, number>) =>
    request<{ code: string; gameId: string }>(
      "/api/games",
      post({ name, counts, ...config, ...conClaseDestino() }),
    ).then(olvidarDestino),
  getGame: (code: string) => request(`/api/games/${code}`),
  joinGame: (code: string, name: string, team: string) =>
    request<{ playerId: string; playerKey: string }>(`/api/games/${code}/join`, post({ name, team })),
  // Perfil, ranking y logros
  profile: () => request<Perfil>("/api/profile"),
  profileRanking: () => request<Ranking>("/api/profile/ranking"),
  profileName: (name: string) =>
    request<{ user: PublicUser }>("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) }),
  passwordLink: () => request<Msg>("/api/auth/password-link", post({})),
  profilePassword: (currentPassword: string, newPassword: string, code?: string) =>
    request<{ ok: true; token?: string; user?: PublicUser }>(
      "/api/profile/password",
      post({ currentPassword, newPassword, code }),
    ),
  // Estadísticas (docente: sus partidas; estudiante: su historial)
  stats: () => request<Stats>("/api/stats"),
  // Banco de preguntas
  questions: () => request<SinTipo[]>("/api/questions"),
  questionBank: () => request("/api/my-questions"),
  questionCreate: (q: SinTipo) => request("/api/my-questions", post(q)),
  questionUpdate: (qid: string, q: SinTipo) =>
    request(`/api/my-questions/${qid}`, { method: "PUT", body: JSON.stringify(q) }),
  questionActive: (qid: string, active: boolean) =>
    request(`/api/my-questions/${qid}/active`, { method: "PATCH", body: JSON.stringify({ active }) }),
  questionDelete: (qid: string) => request<Ok>(`/api/my-questions/${qid}`, { method: "DELETE" }),
  // Crucigrama Relámpago
  crosswordCreate: (name: string, minutes: number, wordCount: number) =>
    request<{ code: string }>("/api/crossword-games", post({ name, minutes, wordCount, ...conClaseDestino() })).then(
      olvidarDestino,
    ),
  crosswordGet: (code: string) => request(`/api/crossword-games/${code}`),
  // Palabra relámpago en línea (cualquier persona con sesión crea; las palabras extra y la clase solo las toma el servidor si es docente)
  palabraCreate: (data: SinTipo) =>
    request<{ code: string; hostPlays: boolean }>("/api/palabra-games", post(data)).then(olvidarDestino),
  palabraGet: (code: string) => request(`/api/palabra-games/${id(code)}`),
  // Clases (curso + sección)
  classes: () => request<{ classes: (ClaseDocente | ClaseEstudiante)[] }>("/api/classes"),
  classCreate: (name: string, section: string) =>
    request<{ class: ClaseDocente }>("/api/classes", post({ name, section })),
  classJoin: (code: string) => request<{ class: ClaseEstudiante }>("/api/classes/join", post({ code })),
  classGet: (cid: string) => request<{ class: ClaseDetalle }>(`/api/classes/${id(cid)}`),
  classUpdate: (cid: string, data: { name?: string; section?: string }) =>
    request<Ok & { name: string; section: string }>(`/api/classes/${id(cid)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  classNewCode: (cid: string) => request<{ code: string }>(`/api/classes/${id(cid)}/code`, post({})),
  classArchive: (cid: string) => request<Ok>(`/api/classes/${id(cid)}`, { method: "DELETE" }),
  classRemoveMember: (cid: string, userId: string) =>
    request<Ok>(`/api/classes/${id(cid)}/members/${id(userId)}`, { method: "DELETE" }),
};

export { API_URL };
