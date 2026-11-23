// ============================================================================
// SOCKET.IO DE "PRESENTACIONES EN VIVO"
// ============================================================================
// Salas de Socket.IO que se usan (todas llevan el código de la sala):
//   ss:<código>:teacher        -> el docente dueño (recibe TODO)
//   ss:<código>:d:<deckKey>    -> los estudiantes que comparten una presentación
//   ss:<código>                -> todos (avisos generales: bloqueo, cierre)
// Los eventos empiezan con "ss:" para no chocar con los de Ludo ni Crucigrama.
// ============================================================================
import { addComment, closeRoom, getRoom, joinStudent, marcarUso, miembrosDe, reopenRoom, rooms, setLocked, setPresence, studentOp, vistaDocente, vistaEstudiante, purgeOld, codigoDeEquipo } from "./engine.js";
import { obtenerSala } from "./persist.js";

const salaDocente = (code) => `ss:${code}:teacher`;
const salaDeck = (code, key) => `ss:${code}:d:${key}`;
const salaTodos = (code) => `ss:${code}`;

const conexiones = new Map(); // "código:studentId" -> cuántos sockets tiene abiertos

function requireOwner(socket, room) {
  const u = socket.data.user;
  if (!u || u.role !== "docente") return "Inicia sesión como docente para controlar esta sala.";
  // Sin dueño (el docente borró su cuenta): nadie la controla; antes podía cualquier docente.
  if (room.ownerId !== u.id) return room.ownerId ? "Esta sala pertenece a otro docente." : "Ya no hay un docente a cargo.";
  return null;
}
const texto = (v) => String(v ?? "").trim();

export function attachSlidesSocket(io, socket) {
  // Freno sencillo: un navegador no debería mandar más de ~80 cambios por segundo.
  let ventana = 0;
  let cuenta = 0;
  const demasiados = () => {
    const ahora = Math.floor(Date.now() / 1000);
    if (ahora !== ventana) { ventana = ahora; cuenta = 0; }
    return ++cuenta > 80;
  };

  // --- El docente abre el panel de su sala ---
  socket.on("ss:watch", async ({ code } = {}, ack) => {
    const room = await obtenerSala(code);
    if (!room) return ack?.({ error: "No existe una sala con ese código." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });
    socket.join([salaDocente(room.code), salaTodos(room.code)]);
    socket.data.ssTeacher = room.code;
    marcarUso(room);
    ack?.({ ok: true, state: vistaDocente(room) });
  });

  // --- El estudiante entra (o vuelve a entrar tras recargar, con el mismo studentId) ---
  socket.on("ss:join", async ({ code, studentId, name, team, teamCode } = {}, ack) => {
    const room = await obtenerSala(code);
    if (!room) return ack?.({ error: "No existe una sala con ese código." });
    // Freno para no adivinar códigos de equipo a fuerza de intentos.
    if ((socket.data.ssCodigosMalos || 0) >= 10) return ack?.({ error: "Demasiados códigos de equipo incorrectos. Recarga la página e inténtalo de nuevo." });
    const { student, entry, error, codigoInvalido } = joinStudent(room, { id: texto(studentId) || null, name, team, teamCode, userId: socket.data.user?.id });
    if (codigoInvalido) socket.data.ssCodigosMalos = (socket.data.ssCodigosMalos || 0) + 1;
    if (error) return ack?.({ error });

    socket.join([salaTodos(room.code), salaDeck(room.code, student.deckKey)]);
    socket.data.ssCode = room.code;
    socket.data.ssStudent = student.id;
    const k = `${room.code}:${student.id}`;
    conexiones.set(k, (conexiones.get(k) || 0) + 1);
    student.online = true;

    ack?.({ ok: true, studentId: student.id, state: vistaEstudiante(room, student) });
    // Al docente le llega el alumno; si su presentación es nueva, también la presentación completa.
    io.to(salaDocente(room.code)).emit("ss:student", {
      student: { id: student.id, name: student.name, deckKey: student.deckKey, online: true, slideId: student.slideId },
      deck: { key: entry.key, name: entry.name, teamCode: codigoDeEquipo(entry.key), deck: entry.deck, comments: entry.comments, updatedAt: entry.updatedAt },
    });
    socket.to(salaDeck(room.code, student.deckKey)).emit("ss:members", { members: miembrosDe(room, student.deckKey) });
  });

  // --- El estudiante cambia su presentación ---
  socket.on("ss:op", ({ op } = {}, ack) => {
    const room = getRoom(socket.data.ssCode);
    if (!room) return ack?.({ error: "No estás en una sala." });
    if (demasiados()) return ack?.({ error: "Demasiados cambios seguidos." });
    const r = studentOp(room, socket.data.ssStudent, op);
    if (r.error) return ack?.({ error: r.error });
    ack?.({ ok: true });
    socket.to(salaDeck(room.code, r.entry.key)).emit("ss:op", { op: r.op });
    io.to(salaDocente(room.code)).emit("ss:op", { key: r.entry.key, op: r.op });
  });

  // --- En qué diapositiva está cada estudiante (para que el docente lo vea) ---
  socket.on("ss:view", ({ slideId } = {}) => {
    const room = getRoom(socket.data.ssCode);
    if (!room) return;
    const st = setPresence(room, socket.data.ssStudent, { slideId: texto(slideId).slice(0, 16) || null });
    if (st) io.to(salaDocente(room.code)).emit("ss:presence", { id: st.id, deckKey: st.deckKey, online: st.online, slideId: st.slideId });
  });

  // --- El docente comenta una diapositiva ---
  socket.on("ss:comment", ({ code, key, sid, text } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe la sala." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });
    const r = addComment(room, texto(key), sid, text);
    if (!r) return ack?.({ error: "No se pudo guardar el comentario." });
    ack?.({ ok: true });
    const payload = { key: texto(key), sid: r.sid, comment: r.comment };
    io.to(salaDeck(room.code, payload.key)).emit("ss:comment", payload);
    socket.to(salaDocente(room.code)).emit("ss:comment", payload);
  });

  socket.on("ss:lock", ({ code, locked } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe la sala." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });
    setLocked(room, locked);
    ack?.({ ok: true });
    io.to(salaTodos(room.code)).emit("ss:room", { locked: room.locked, status: room.status });
  });

  socket.on("ss:reopen", ({ code } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe la sala." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });
    reopenRoom(room);
    ack?.({ ok: true });
    io.to(salaTodos(room.code)).emit("ss:room", { locked: room.locked, status: room.status });
  });

  socket.on("ss:close", ({ code } = {}, ack) => {
    const room = getRoom(code);
    if (!room) return ack?.({ error: "No existe la sala." });
    const problema = requireOwner(socket, room);
    if (problema) return ack?.({ error: problema });
    closeRoom(room);
    ack?.({ ok: true });
    io.to(salaTodos(room.code)).emit("ss:room", { locked: room.locked, status: room.status });
  });

  socket.on("disconnect", () => {
    const { ssCode: code, ssStudent: id } = socket.data;
    if (!code || !id) return;
    const k = `${code}:${id}`;
    const n = (conexiones.get(k) || 1) - 1;
    if (n > 0) return conexiones.set(k, n);
    conexiones.delete(k);
    const room = getRoom(code);
    const st = room && setPresence(room, id, { online: false });
    if (st) {
      io.to(salaDocente(code)).emit("ss:presence", { id, deckKey: st.deckKey, online: false, slideId: st.slideId });
      io.to(salaDeck(code, st.deckKey)).emit("ss:members", { members: miembrosDe(room, st.deckKey) });
    }
  });
}

// Limpieza: las salas de más de 24 h salen de la memoria.
export function startSlidesCleanup() {
  setInterval(() => purgeOld(Date.now() - 24 * 60 * 60 * 1000), 10 * 60 * 1000).unref?.();
}
export { rooms };