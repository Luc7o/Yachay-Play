// ============================================================================
// ¿QUIÉN CONTROLA LA SALA? (guard de anfitrión)
// ============================================================================
// Solo quien creó la sala (su `ownerId`) puede iniciarla, pasar de pregunta,
// terminarla, etc. Si la cuenta dueña se borró (`ownerId` = null) NADIE la
// controla: antes cualquier docente podía tomarla.
//
// Cada juego escribe sus propios mensajes (dice "evaluación", "partida", "sala"...),
// por eso el guard se arma con ellos:
//
//   const problemaDeDueno = crearGuardDueno({
//     sinSesion: "Inicia sesión como docente para controlar esta partida.",
//     otro: "Esta partida pertenece a otro docente.",
//     sinDueno: "Ya no hay un docente a cargo.",
//   });
//   const problema = problemaDeDueno(socket.data.user, room); // null = sí puede
// ============================================================================

// Motivo por el que `user` NO controla `sala`, o null si sí la controla.
//   "sin-sesion": no hay sesión (o no es docente, cuando se exige docente)
//   "sin-dueno":  la sala ya no tiene dueño
//   "otro":       la sala es de otra cuenta
export function motivoNoDueno(user, sala, { requiereDocente = true } = {}) {
  if (!user || (requiereDocente && user.role !== "docente")) return "sin-sesion";
  if (!sala?.ownerId) return "sin-dueno";
  if (sala.ownerId !== user.id) return "otro";
  return null;
}

export const esDueno = (user, sala, opciones) => motivoNoDueno(user, sala, opciones) === null;

// Devuelve (user, sala) => mensaje de error | null.
export function crearGuardDueno(mensajes, opciones = {}) {
  const textos = { "sin-sesion": mensajes.sinSesion, otro: mensajes.otro, "sin-dueno": mensajes.sinDueno };
  return (user, sala) => {
    const motivo = motivoNoDueno(user, sala, opciones);
    return motivo ? textos[motivo] : null;
  };
}
