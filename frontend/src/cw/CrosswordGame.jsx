import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { socket } from "../socket";
import { LS_STUDENT, LS_TEACHER, loadJSON, saveJSON, emitConTiempoLimite } from "./helpers";
import { CwGate } from "./CwGate";
import { CwTeacherSetup } from "./CwTeacherSetup";
import { CwTeacherRoom } from "./CwTeacherRoom";
import { CwStudentJoin } from "./CwStudentJoin";
import { CwStudentRoom } from "./CwStudentRoom";

// ============================================================================
// CRUCIGRAMA RELÁMPAGO — juego nuevo de YachayPlay
// ============================================================================
// Todo el juego vive en este único archivo, aparte del Ludo, para no
// arriesgar nada de lo que ya funciona. Usa el mismo socket compartido
// (los eventos empiezan con "cw:" para no chocar con los de Ludo "engineer:").
//
// Tableros individuales iguales: todos reciben el MISMO crucigrama, pero cada
// quien lo llena por su cuenta (es una carrera). El servidor nunca manda las
// respuestas de un rival, solo su % de avance y su puntaje.
// ============================================================================

// Si App.jsx pasa `frame`, la configuración del docente se muestra dentro del menú lateral.
export const conMarco = (frame, pagina) => (frame ? frame(pagina) : pagina);

export function CrosswordGame({ user, onLogin, onRegister, goHome, initialCode = "", onGuestCode, frame }) {
  // Si ya hay sesión, arrancamos directo en la pantalla de su rol (sin pasar
  // primero por "gate"): así no se alcanza a ver un parpadeo de esa pantalla
  // antes de que el useEffect de abajo la cambie.
  const [view, setView] = useState(() =>
    initialCode
      ? "student-join" // llegó con un código (acceso de invitado): directo a unirse
      : user?.role === "docente" ? "teacher-setup" : user?.role === "estudiante" ? "student-join" : "gate"
  ); // gate | teacher-setup | teacher-room | student-join | student-room
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [live, setLive] = useState(null); // último cw:state recibido
  const [myId, setMyId] = useState(null);
  const [solvedMap, setSolvedMap] = useState({}); // placementId -> palabra (para dibujar el tablero)
  const [now, setNow] = useState(Date.now());
  const [toasts, setToasts] = useState([]); // avisos de sabotajes, se borran solos

  // Reloj interno: para las cuentas regresivas (tiempo, congelado, niebla, enfriamiento).
  // Solo debe correr en las pantallas que en verdad muestran algo en vivo: si
  // corriera también en "configuración" o "unirse", repintaría esas pantallas
  // 2 veces por segundo sin necesidad (eso era lo que causaba el parpadeo y
  // no dejaba escribir con comodidad en los formularios).
  useEffect(() => {
    if (view !== "teacher-room" && view !== "student-room") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [view]);

  // --- si el docente ya tenía una sala creada (recargó la página), la recupera ---
  // Se ejecuta una sola vez al montar (por eso el "ref", no depende de `view`,
  // que ya arrancó en la pantalla correcta gracias al useState de arriba).
  const yaRevisoReconexion = useRef(false);
  useEffect(() => {
    if (yaRevisoReconexion.current || user?.role !== "docente") return;
    yaRevisoReconexion.current = true;
    const codigoGuardado = loadJSON(LS_TEACHER);
    if (!codigoGuardado) return; // ya está en "teacher-setup" por el estado inicial
    setCode(codigoGuardado);
    emitConTiempoLimite("cw:watch-room", { code: codigoGuardado }, (ack) => {
      if (ack?.ok) {
        setLive(ack.state);
        setView("teacher-room");
      } else {
        saveJSON(LS_TEACHER, null);
        setView("teacher-setup");
      }
    });
  }, [user]);

  // --- reconectar como estudiante tras recargar la página ---
  useEffect(() => {
    const guardado = loadJSON(LS_STUDENT);
    if (!guardado || view !== "student-join") return;
    socket.emit(
      "cw:join-room",
      { code: guardado.code, playerId: guardado.playerId, name: user?.name || "" },
      (ack) => {
        if (ack?.ok) {
          setMyId(ack.playerId);
          setCode(guardado.code);
          setLive(ack.state);
          setView("student-room");
        } else {
          saveJSON(LS_STUDENT, null);
        }
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- escuchar el estado en vivo del servidor ---
  useEffect(() => {
    function onState(payload) {
      setLive(payload);
      if (payload.me?.solvedWords) {
        setSolvedMap((prev) => {
          const next = { ...prev };
          for (const w of payload.me.solvedWords) next[w.placementId] = w.word;
          return next;
        });
      }
    }
    function onSabotage(r) {
      const soyYo = r.targetId === myId;
      const fuiYo = r.sourceId === myId;
      const label = { freeze: "te congeló", fog: "te puso niebla", steal: "te robó puntos" }[r.type];
      const labelYo = { freeze: "Congelaste a", fog: "Le pusiste niebla a", steal: "Le robaste puntos a" }[r.type];
      const nombre = (id) => live?.leaderboard?.find((p) => p.id === id)?.name || "alguien";
      let texto = null;
      if (soyYo) texto = `⚠️ ${nombre(r.sourceId)} ${label}`;
      else if (fuiYo) texto = `${labelYo} ${nombre(r.targetId)}` + (r.stolen ? ` (+${r.stolen} pts)` : "");
      if (texto) {
        const id = Math.random();
        setToasts((t) => [...t, { id, texto }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
      }
    }
    socket.on("cw:state", onState);
    socket.on("cw:sabotage-used", onSabotage);
    return () => {
      socket.off("cw:state", onState);
      socket.off("cw:sabotage-used", onSabotage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, live?.leaderboard]);

  function volverAlCatalogo() {
    saveJSON(LS_TEACHER, null);
    saveJSON(LS_STUDENT, null);
    goHome();
  }

  if (view === "gate") {
    return (
      <CwGate
        onLogin={onLogin}
        onRegister={onRegister}
        onGuest={() => (onGuestCode ? onGuestCode() : setView("student-join"))}
        onBack={goHome}
      />
    );
  }

  if (view === "teacher-setup") {
    return conMarco(
      frame,
      <CwTeacherSetup
        goHome={volverAlCatalogo}
        error={error}
        onCreate={(name, minutes, wordCount) => {
          setError("");
          api
            .crosswordCreate(name, minutes, wordCount)
            .then((r) => {
              setCode(r.code);
              saveJSON(LS_TEACHER, r.code);
              emitConTiempoLimite("cw:watch-room", { code: r.code }, (ack) => {
                if (ack?.ok) {
                  setLive(ack.state);
                  setView("teacher-room");
                } else setError(ack?.error || "No se pudo abrir la sala.");
              });
            })
            .catch((e) => setError(e.message));
        }}
      />
    );
  }

  if (view === "teacher-room") {
    return (
      <CwTeacherRoom
        code={code}
        live={live}
        now={now}
        goHome={volverAlCatalogo}
        onStart={() => emitConTiempoLimite("cw:start", { code }, (ack) => ack?.error && setError(ack.error))}
        onEnd={() => {
          if (!window.confirm("¿Finalizar la partida ahora mismo para todos? Verán los resultados de inmediato.")) return;
          emitConTiempoLimite("cw:end", { code }, (ack) => ack?.error && setError(ack.error));
        }}
        onReset={() => {
          if (!window.confirm("Esto pone el marcador de todos en cero y los regresa a la sala de espera (el código sigue siendo el mismo). ¿Continuar?")) return;
          emitConTiempoLimite("cw:reset", { code }, (ack) => ack?.error && setError(ack.error));
        }}
        onNewGame={() => {
          saveJSON(LS_TEACHER, null);
          setLive(null);
          setError("");
          setView("teacher-setup");
        }}
        error={error}
      />
    );
  }

  if (view === "student-join") {
    return (
      <CwStudentJoin
        goHome={goHome}
        prefillName={user?.name || ""}
        initialCode={initialCode}
        error={error}
        onJoin={(codigo, name) => {
          setError("");
          emitConTiempoLimite("cw:join-room", { code: codigo, name }, (ack) => {
            if (ack?.ok) {
              setMyId(ack.playerId);
              setCode(codigo);
              saveJSON(LS_STUDENT, { code: codigo, playerId: ack.playerId });
              setLive(ack.state);
              setView("student-room");
            } else setError(ack?.error || "No se pudo unir a la partida.");
          });
        }}
      />
    );
  }

  if (view === "student-room") {
    return (
      <CwStudentRoom
        live={live}
        now={now}
        myId={myId}
        code={code}
        solvedMap={solvedMap}
        toasts={toasts}
        goHome={volverAlCatalogo}
        onSubmit={(placementId, guess, cb) =>
          emitConTiempoLimite("cw:submit", { placementId, guess }, (ack) => cb(ack))
        }
        onSabotage={(targetId, type, cb) =>
          emitConTiempoLimite("cw:sabotage", { targetId, type }, (ack) => cb(ack))
        }
      />
    );
  }

  return null;
}
