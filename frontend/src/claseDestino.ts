// ============================================================================
// "CLASE DESTINO": a qué clase irá la próxima actividad que cree el docente.
// ============================================================================
// Desde el detalle de una clase, el docente pulsa "Lanzar Ludo" (o crucigrama,
// evaluación, presentaciones). Se guarda aquí la clase y se abre el juego como
// siempre; al crear la partida, api.js / Evaluacion / Estudio agregan `classId`.
// Se olvida al crear la partida, al volver al inicio o al pulsar "Quitar" en el aviso.
// ============================================================================
import { useSyncExternalStore } from "react";

const CLAVE = "yp_clase_destino";
type Destino = { id: string; name: string } | null;
let destino: Destino = leer();
const oyentes = new Set<() => void>();

function leer(): Destino {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE) || "null");
  } catch {
    return null;
  }
}

export function getClaseDestino() {
  return destino;
}

export function setClaseDestino(clase: { id: string; name: string } | null) {
  destino = clase ? { id: clase.id, name: clase.name } : null;
  try {
    if (destino) sessionStorage.setItem(CLAVE, JSON.stringify(destino));
    else sessionStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: dura mientras la pestaña esté abierta */
  }
  oyentes.forEach((fn) => fn());
}

export const limpiarClaseDestino = () => setClaseDestino(null);

// Para el cuerpo de las peticiones de creación: { classId } o {}.
export const conClaseDestino = () => (destino ? { classId: destino.id } : {});

export function useClaseDestino() {
  return useSyncExternalStore(
    (fn) => {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    () => destino,
  );
}
