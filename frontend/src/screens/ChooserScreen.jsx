import { Brand } from "../Brand";
import { LudoIcon } from "../GameCatalog";
import { BUILD_VERSION } from "../constants";

export function ChooserScreen({ onLogin, onRegister, onGuest, onBack }) {
  const pasos = [
    { n: 1, t: "El docente crea la partida", d: "Elige cuántos equipos juegan y los tiempos, y proyecta el código." },
    { n: 2, t: "Los estudiantes se unen", d: "Cada uno entra desde su celular con el código y elige su equipo de color." },
    { n: 3, t: "Lanzan el dado y responden", d: "El equipo en turno lanza el dado y contesta una pregunta antes de que acabe el tiempo." },
    { n: 4, t: "Acierta y avanza", d: "Si aciertan, la ficha avanza lo que marcó el dado. El primero en llegar a la meta gana." },
  ];
  return (
    <div className="app role-page">
      <header className="ref-topbar">
        <Brand subtitle="Ludo Educativo" onClick={onBack} />
      </header>

      <main className="role-main">
        <button className="back-link" onClick={onBack}>← Volver al inicio</button>

        <section className="role-intro">
          <img
            className="role-mascot"
            src="/mascota-explica.png"
            alt="Mascota de YachayPlay, un dragón andino con chullo y tableta, señalando con el dedo"
          />
          <div className="role-intro-text">
            <span className="hero-eyebrow">JUEGO · LUDO EDUCATIVO</span>
            <h1>Avanza por el tablero respondiendo preguntas</h1>
            <p>
              Un Ludo en tiempo real para el aula: los equipos compiten por llegar a la meta, pero solo avanzan
              cuando aciertan. Ideal para repasar temas como los <b>Inventos Históricos de la Ingeniería</b>.
            </p>
            <div className="role-tags">
              <span>👥 2 a 4 equipos</span>
              <span>📱 Desde el celular</span>
              <span>⏱️ Tiempos configurables</span>
              <span>🏆 Ranking al final</span>
            </div>
          </div>
          <div className="role-intro-icon">
            <LudoIcon />
          </div>
        </section>

        <h2 className="role-question">Entra a tu cuenta para jugar</h2>
        <div className="role-cards">
          <button className="role-card role-card-teacher" onClick={onLogin}>
            <span className="role-card-icon">🔑</span>
            <strong>Ya tengo cuenta</strong>
            <span className="role-card-desc">
              Inicia sesión y entrarás directo a tu panel: los docentes a crear partidas y los estudiantes a unirse.
              Tu rol ya está guardado.
            </span>
            <span className="role-card-cta">Iniciar sesión →</span>
          </button>

          <button className="role-card role-card-student" onClick={onRegister}>
            <span className="role-card-icon">✨</span>
            <strong>Soy nuevo</strong>
            <span className="role-card-desc">
              Crea tu cuenta gratis en un minuto y elige si eres docente o estudiante. El rol se elige una sola vez.
            </span>
            <span className="role-card-cta">Crear cuenta →</span>
          </button>
        </div>

        <div className="role-guest">
          <span>¿Solo quieres unirte a una partida con el código de tu docente?</span>
          <button onClick={onGuest}>Entrar como invitado →</button>
        </div>

        <h2 className="role-question">Así se juega</h2>
        <ol className="role-steps">
          {pasos.map((p) => (
            <li key={p.n}>
              <span className="role-step-n">{p.n}</span>
              <strong>{p.t}</strong>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="build-mark">YachayPlay · Build {BUILD_VERSION}</footer>
    </div>
  );
}
