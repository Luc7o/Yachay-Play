// ============================================================================
// DIFUSIÓN DE ESTADO POR SOCKET
// ============================================================================
// En los juegos en vivo cada quien ve algo distinto (el docente ve más; cada
// estudiante ve su propio puntaje o tablero), así que no basta con un solo
// `io.to(sala).emit(...)`: hay que recorrer los sockets de la sala y mandarle a
// cada uno SU vista, armada con lo que guardó en `socket.data`.
//
//   await enviarVistas(io, `qz:${code}`, {
//     evento: "qz:state",
//     pertenece: (data) => data.qzCode === code,   // ignora sockets que ya no son de esta sala
//     vista: (data) => publicState(room, data.qzPlayerId, data.qzTeacher),
//   });
// ============================================================================

// Devuelve cuántos sockets recibieron el estado. Si `io` no sabe `fetchSockets`
// (p. ej. un io de prueba) no pasa nada: simplemente no hay eco en vivo.
/**
 * @param {any} io
 * @param {string} salaSocket
 * @param {{ evento: string, vista: (data: any) => unknown, pertenece?: (data: any) => boolean }} opciones
 */
export async function enviarVistas(io, salaSocket, { evento, vista, pertenece = () => true }) {
  let sockets;
  try {
    sockets = await io.in(salaSocket).fetchSockets();
  } catch {
    return 0;
  }
  let enviados = 0;
  for (const s of sockets) {
    const data = s.data || {};
    if (!pertenece(data)) continue;
    s.emit(evento, vista(data));
    enviados++;
  }
  return enviados;
}
