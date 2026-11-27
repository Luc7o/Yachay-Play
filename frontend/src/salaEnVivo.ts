// ============================================================================
// SALAS EN VIVO: lo que comparten Ludo, Crucigrama, Palabra, Evaluación y
// Presentaciones para hablar con su sala por socket.
// ----------------------------------------------------------------------------
//   useSalaEnVivo({ eventos, alReconectar, clave })
//     - escucha los eventos del servidor (siempre con el manejador más reciente,
//       sin desuscribirse en cada render),
//     - al reconectarse el socket (celular bloqueado, cambio de red...) llama a
//       alReconectar para volver a entrar a la sala: el socket nuevo no está en
//       ninguna y la partida se vería congelada,
//     - devuelve `conectado` para mostrar "Reconectando…".
//   `clave` (p. ej. el código de la sala): al cambiar, se vuelve a suscribir.
//
//   emitirConTiempo(evento, datos, respuesta): emite y, si el servidor no
//   contesta en 8 s, responde con un error en vez de quedarse esperando.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import type { EventosDelServidor } from "../../shared/types/sockets";

type Manejador = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
export type EventosSala = Partial<Record<keyof EventosDelServidor, Manejador>>;

export function useSalaEnVivo({
  eventos = {},
  alReconectar,
  clave,
  activo = true,
}: {
  eventos?: EventosSala;
  alReconectar?: () => void;
  clave?: unknown;
  activo?: boolean;
}): { conectado: boolean } {
  const [conectado, setConectado] = useState(socket.connected);
  const eventosRef = useRef(eventos);
  const reconectarRef = useRef(alReconectar);
  eventosRef.current = eventos;
  reconectarRef.current = alReconectar;
  const nombres = Object.keys(eventos).sort().join(",");

  useEffect(() => {
    if (!activo) return;
    const quitar: (() => void)[] = [];
    for (const nombre of nombres ? nombres.split(",") : []) {
      const reenviar: Manejador = (...args) => eventosRef.current[nombre as keyof EventosDelServidor]?.(...args);
      socket.on(nombre as keyof EventosDelServidor, reenviar);
      quitar.push(() => socket.off(nombre as keyof EventosDelServidor, reenviar));
    }
    const alConectar = () => {
      setConectado(true);
      reconectarRef.current?.();
    };
    const alCaer = () => setConectado(false);
    socket.on("connect", alConectar);
    socket.on("disconnect", alCaer);
    return () => {
      quitar.forEach((f) => f());
      socket.off("connect", alConectar);
      socket.off("disconnect", alCaer);
    };
  }, [nombres, clave, activo]);

  return { conectado };
}

/** Emite un evento con respuesta; si el servidor no contesta a tiempo, responde con un error. */
export function emitirConTiempo(
  evento: string,
  datos: unknown,
  respuesta?: (ack: any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
  esperaMs = 8000,
): void {
  let resuelto = false;
  const avisoTardio = setTimeout(() => {
    if (resuelto) return;
    resuelto = true;
    respuesta?.({
      error:
        "El servidor no respondió a tiempo. Revisa que el backend esté encendido y actualizado (reinícialo si acabas de aplicar cambios) e inténtalo de nuevo.",
    });
  }, esperaMs);
  // El tipo de cada evento está en shared/types/sockets.ts; aquí se acepta cualquiera.
  (socket.emit as (e: string, d: unknown, cb: (ack: unknown) => void) => void)(evento, datos, (ack) => {
    if (resuelto) return; // ya se disparó el aviso por tardanza; esta respuesta llegó demasiado tarde
    resuelto = true;
    clearTimeout(avisoTardio);
    respuesta?.(ack);
  });
}
