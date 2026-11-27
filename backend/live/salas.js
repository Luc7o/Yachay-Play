// ============================================================================
// REGISTRO DE SALAS EN MEMORIA
// ============================================================================
// Cada juego guarda sus salas activas en un Map (código -> sala). Este módulo
// reúne lo que todos repetían: buscar por código (aceptando espacios alrededor),
// guardar con un código libre y sacar de la memoria las salas viejas.
//
//   const registro = crearRegistro();
//   export const rooms = registro.salas;      // el Map, por si alguien lo recorre
//   registro.guardar({ code: registro.nuevoCodigo(), ... });
//   registro.obtener(" 123456 ");             // -> sala | null
//   registro.purgarViejas(Date.now() - 12 h); // -> salas quitadas
// ============================================================================
import { codigoLibre } from "./codigos.js";

// El código como lo guardamos: texto sin espacios alrededor.
export const normalizarCodigo = (code) => String(code ?? "").trim();

// `ultimoUso(sala)` dice desde cuándo cuenta la sala para la limpieza (por defecto,
// su `createdAt`). Las presentaciones, por ejemplo, cuentan también la última
// vez que alguien las usó.
export function crearRegistro({ ultimoUso = (sala) => sala.createdAt } = {}) {
  const salas = new Map();
  return {
    salas,
    obtener: (code) => salas.get(normalizarCodigo(code)) || null,
    nuevoCodigo: () => codigoLibre(salas),
    guardar(sala) {
      salas.set(sala.code, sala);
      return sala;
    },
    // Quita la sala solo si sigue siendo ESA (no otra que reusó el código).
    quitar(sala) {
      if (salas.get(sala.code) === sala) salas.delete(sala.code);
    },
    // Quita las salas cuyo último uso es anterior a `limiteMs` y las devuelve
    // (para que el juego cierre en la BD lo que haga falta).
    purgarViejas(limiteMs) {
      const quitadas = [];
      for (const [code, sala] of salas) {
        if (ultimoUso(sala) < limiteMs) {
          salas.delete(code);
          quitadas.push(sala);
        }
      }
      return quitadas;
    },
  };
}
