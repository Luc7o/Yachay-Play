const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// --- Sesión: el token se guarda en el navegador para no volver a iniciar sesión ---
const TOKEN_KEY = "yachay_token";
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* modo privado: la sesión durará solo mientras la pestaña esté abierta */
  }
}

async function request(path, options = {}) {
  const token = getToken();
  let res;
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
    const err = new Error(data.error || porCodigo);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Cuentas
  register: ({ name, email, password, role }) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password, role }) }),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request("/api/auth/me"),
  demoAccounts: () => request("/api/auth/demo"),
  assistantChat: (messages) => request("/api/assistant/chat", { method: "POST", body: JSON.stringify({ messages }) }),
  // Partidas
  createGame: (name, counts, config) =>
    request("/api/games", { method: "POST", body: JSON.stringify({ name, counts, ...config }) }),
  getGame: (code) => request(`/api/games/${code}`),
  joinGame: (code, name, team) =>
    request(`/api/games/${code}/join`, { method: "POST", body: JSON.stringify({ name, team }) }),
  // Perfil, ranking y logros
  profile: () => request("/api/profile"),
  profileRanking: () => request("/api/profile/ranking"),
  profileName: (name) => request("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) }),
  profilePassword: (currentPassword, newPassword) =>
    request("/api/profile/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  // Estadísticas (docente: sus partidas; estudiante: su historial)
  stats: () => request("/api/stats"),
  // Banco de preguntas
  questions: () => request("/api/questions"),
  questionBank: () => request("/api/my-questions"),
  questionCreate: (q) => request("/api/my-questions", { method: "POST", body: JSON.stringify(q) }),
  questionUpdate: (id, q) => request(`/api/my-questions/${id}`, { method: "PUT", body: JSON.stringify(q) }),
  questionActive: (id, active) => request(`/api/my-questions/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) }),
  questionDelete: (id) => request(`/api/my-questions/${id}`, { method: "DELETE" }),
  // Crucigrama Relámpago
  crosswordCreate: (name, minutes, wordCount) =>
    request("/api/crossword-games", { method: "POST", body: JSON.stringify({ name, minutes, wordCount }) }),
  crosswordGet: (code) => request(`/api/crossword-games/${code}`),
};

export { API_URL };
