import { GameGate, CrosswordPreview, CrosswordSabotagesExtra } from "../GameGate";

// ============================================================================
// PUERTA DE ENTRADA (sin cuenta): igual de espíritu que la de Ludo, pero
// pensada para cualquier juego nuevo, no solo para Ludo.
// ============================================================================
export function CwGate({ onLogin, onRegister, onGuest, onBack }) {
  return (
    <GameGate
      theme="crossword"
      subtitle="Crucigrama Relámpago"
      eyebrow="JUEGO · CRUCIGRAMA RELÁMPAGO"
      title={<>Compite llenando el crucigrama <span className="gate-hl">antes que tus rivales</span></>}
      description={
        <>
          Todos reciben el mismo crucigrama y compiten por terminarlo primero. Acertar rápido y en racha
          junta energía para lanzar <b>sabotajes</b> a tus rivales: congélalos, ponles niebla o róbales puntos.
          Si nadie lo completa, gana quien tenga más puntos.
        </>
      }
      tags={["🏁 Carrera individual", "⚡ Sabotajes", "📱 Desde el celular", "🏆 Ranking en vivo"]}
      stats={[
        { value: "6–20", label: "palabras por partida" },
        { value: "3–20", label: "minutos de duración" },
        { value: "3", label: "sabotajes para usar" },
      ]}
      mascot={{
        src: "/mascota-gana.png",
        alt: "Mascota de YachayPlay, un dragón andino con chullo, celebrando con un trofeo",
      }}
      preview={<CrosswordPreview />}
      loginPoints={[
        "Los docentes crean el crucigrama y proyectan el código",
        "Los estudiantes entran y compiten en vivo",
        "Tu rol ya está guardado",
      ]}
      registerPoints={[
        "Gratis y en menos de un minuto",
        "Eliges si eres docente o estudiante, una sola vez",
        "No necesitas instalar nada",
      ]}
      guestText="¿Solo quieres unirte con el código de tu docente?"
      steps={[
        { icon: "🖥️", t: "El docente crea la partida", d: "Elige cuántas palabras y cuánto dura, y proyecta el código de 6 dígitos." },
        { icon: "📱", t: "Los estudiantes se unen", d: "Cada uno entra desde su celular con el código y escribe su nombre." },
        { icon: "✏️", t: "Resuelven las pistas", d: "Cada quien llena su propio tablero. Acertar rápido y en racha suma puntos y energía." },
        { icon: "🏆", t: "Completa y gana", d: "Gana quien complete todo el crucigrama primero. Si se acaba el tiempo, gana quien tenga más puntos." },
      ]}
      extra={<CrosswordSabotagesExtra />}
      onLogin={onLogin}
      onRegister={onRegister}
      onGuest={onGuest}
      onBack={onBack}
    />
  );
}
