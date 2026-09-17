import { io } from "socket.io-client";
import { API_URL } from "./api";

// Una sola conexión de socket compartida por toda la app.
export const socket = io(API_URL, { autoConnect: true });
