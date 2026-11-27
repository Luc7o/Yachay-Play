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

// Atajo para los eventos de socket que solo puede disparar el anfitrión (iniciar,
// pasar, terminar...). Hace siempre lo mismo: busca la sala, revisa que quien
// llama sea el dueño, ejecuta la acción, responde por `ack` y avisa a la sala.
//
//   const anfitrion = crearAccionesDeAnfitrion(socket, {
//     buscar: ({ code }) => getRoom(code),         // payload -> sala | null
//     noExiste: "No existe esa evaluación.",
//     problema: (room) => problemaDeDueno(socket.data.user, room),
//     despues: (room) => broadcast(io, room.code), // solo si la acción salió bien
//   });
//   anfitrion("qz:start", start);
//
// La acción recibe (sala, payload) y devuelve { error } o algo más (o nada); el
// `ack` recibe { error } o { ok: true, ...lo que devolvió }.
export function crearAccionesDeAnfitrion(socket, { buscar, noExiste, problema, despues }) {
  return (evento, accion) =>
    socket.on(evento, (payload, ack) => {
      const datos = payload && typeof payload === "object" ? payload : {};
      const sala = buscar(datos);
      if (!sala) return ack?.({ error: noExiste });
      const p = problema(sala);
      if (p) return ack?.({ error: p });
      const r = accion(sala, datos);
      if (r?.error) return ack?.({ error: r.error });
      ack?.({ ok: true, ...(r || {}) });
      despues?.(sala, r, datos);
    });
}
