import { io, type Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";
import type { EventosAlServidor, EventosDelServidor } from "../../shared/types/sockets";

// Una sola conexión de socket compartida por toda la app.
// Al conectarse manda el token de la sesión para que el servidor sepa si es un docente.
// Los nombres de evento y sus datos están tipados en shared/types/sockets.ts.
export const socket: Socket<EventosDelServidor, EventosAlServidor> = io(API_URL, {
  autoConnect: true,
  auth: (cb) => cb({ token: getToken() }),
});

// Se llama al iniciar o cerrar sesión para que el servidor vea el token nuevo.
export function reconnectSocket(): void {
  socket.disconnect();
  socket.connect();
}
