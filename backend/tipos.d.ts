// ============================================================================
// TIPOS DEL BACKEND (solo para revisar con tsc; no se ejecuta)
// ----------------------------------------------------------------------------
// El backend sigue en JavaScript: tsc lo revisa con estos tipos y los de
// ../shared/types. En un archivo .js se usan con JSDoc, por ejemplo:
//   /** @param {import("../tipos").SocketApp} socket */
// ============================================================================
import type { Server, Socket } from "socket.io";
import type { EventosAlServidor, EventosDelServidor } from "../shared/types/sockets";
import type { Rol } from "../shared/types/api";

/**
 * Lo que llega de un cliente no es confiable: puede faltar el objeto o cualquier
 * campo. Del lado del servidor cada evento recibe sus datos como opcionales y
 * parciales (por eso los manejadores usan `({ code } = {}, ack)` y validan).
 */
type Entrante<T> = {
  [K in keyof T]: T[K] extends (d: infer D, ...resto: infer R) => void ? (d?: Partial<D>, ...resto: R) => void : T[K];
};

/** Socket.IO con los eventos de shared/types/sockets.ts. */
export type ServidorApp = Server<Entrante<EventosAlServidor>, EventosDelServidor>;
export type SocketApp = Socket<Entrante<EventosAlServidor>, EventosDelServidor>;

/** Fila de la tabla users (lo que deja authOptional en req.user). */
export interface UsuarioDb {
  id: string;
  name: string;
  email: string;
  role: Rol;
  password_hash: string;
  token_version: number;
  totp_enabled: boolean;
  totp_secret: string | null;
  totp_last_step: number | null;
  email_verified_at: Date | string | null;
  terms_accepted_at: Date | string | null;
  created_at: Date | string;
  [columna: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      /** Usuario de la sesión (o null). Lo pone authOptional en server.js. */
      user?: UsuarioDb | null;
    }
  }
}
