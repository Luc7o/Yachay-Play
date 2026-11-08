import { io } from "socket.io-client";
import { API_URL, getToken } from "./api";

// Una sola conexión de socket compartida por toda la app.
// Al conectarse manda el token de la sesión para que el servidor sepa si es un docente.
export const socket = io(API_URL, {
  autoConnect: true,
  auth: (cb) => cb({ token: getToken() }),
});

// Se llama al iniciar o cerrar sesión para que el servidor vea el token nuevo.
export function reconnectSocket() {
  socket.disconnect();
  socket.connect();
}
