import { useEffect, useState } from "react";
import { api, getToken, setToken } from "../api";
import { reconnectSocket } from "../socket";
import type { AuthOk, PublicUser } from "../../../shared/types/api";

// ============================================================================
// SESIÓN: quién está conectado (o nadie) y cómo se entra y se sale.
// El rol (docente / estudiante) se elige una sola vez al registrarse.
// ============================================================================
export function useSesion() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authReady, setAuthReady] = useState(() => !getToken()); // false mientras se valida la sesión guardada

  // Al abrir la app: si hay una sesión guardada, se comprueba que siga siendo válida.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(({ user: u }) => setUser(u))
      .catch((e: { status?: number }) => {
        if (e.status === 401) setToken(null); // sesión vencida: se olvida
      })
      .finally(() => setAuthReady(true));
  }, []);

  // El Asistente IA (fuera de App) escucha este evento para aparecer o desaparecer.
  const avisar = () => window.dispatchEvent(new Event("yachay-auth-changed"));

  function iniciar({ token, user: u }: AuthOk) {
    setToken(token);
    reconnectSocket(); // el servidor debe ver el token nuevo
    setUser(u);
    avisar();
  }

  function cerrar() {
    setToken(null);
    reconnectSocket();
    setUser(null);
    avisar();
  }

  return { user, setUser, authReady, iniciar, cerrar };
}
