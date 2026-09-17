const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de conexión con el servidor");
  return data;
}

export const api = {
  createGame: (name, counts, config) =>
    request("/api/games", { method: "POST", body: JSON.stringify({ name, counts, ...config }) }),
  getGame: (code) => request(`/api/games/${code}`),
  joinGame: (code, name, team) =>
    request(`/api/games/${code}/join`, { method: "POST", body: JSON.stringify({ name, team }) }),
};

export { API_URL };
