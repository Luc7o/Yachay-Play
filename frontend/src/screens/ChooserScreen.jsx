import { Marca, BotonTema, Icono } from "../campusUi";
import { BUILD_VERSION } from "../constants";

// ============================================================================
// LUDO · ¿CÓMO QUIERES ENTRAR? (sin sesión) — diseño "Campus". Props sin cambios.
// ============================================================================
export function ChooserScreen({ onLogin, onRegister, onGuest, onBack }) {
  const pasos = [
    { n: 1, t: "El docente crea la partida", d: "Elige cuántos equipos juegan y los tiempos, y proyecta el código." },
    { n: 2, t: "Los estudiantes se unen", d: "Cada uno entra desde su celular con el código y elige su equipo." },
    { n: 3, t: "Lanzan el dado y responden", d: "El equipo en turno lanza el dado y contesta antes de que acabe el tiempo." },
    { n: 4, t: "Acierta y avanza", d: "Si aciertan, la ficha avanza lo que marcó el dado. Gana quien llega primero a la meta." },
  ];
  const Ludo = Icono.ludo;
  return (
    <div className="cp cp-landing">
      <header className="cp-pubhead">
        <div className="cp-wrap">
          <Marca onClick={onBack} label="Volver al inicio de YachayPlay" />
          <div className="cp-pubauth" style={{ marginLeft: "auto" }}>
            <BotonTema />
            <button type="button" className="cp-btn quiet" onClick={onBack}>← Volver</button>
          </div>
        </div>
      </header>

      <main className="cp-wrap ch-main">
        <section className="ch-intro">
          <span className="cp-ico ch-ico"><Ludo /></span>
          <div>
            <span className="cp-eyebrow accent">Juego · Ludo por equipos</span>
            <h1>Avanza por el tablero respondiendo preguntas</h1>
            <p>Un Ludo en tiempo real para la clase: los equipos compiten por llegar a la meta, pero solo avanzan cuando aciertan.</p>
            <ul className="ch-tags">
              <li className="cp-chip">2 a 4 equipos</li>
              <li className="cp-chip">Desde el celular</li>
              <li className="cp-chip">Tiempos configurables</li>
              <li className="cp-chip">Ranking al final</li>
            </ul>
          </div>
        </section>

        <h2 className="cp-sec-title">Entra para jugar</h2>
        <div className="cp-tiles">
          <button type="button" className="cp-tile" onClick={onLogin}>
            <strong>Ya tengo cuenta</strong>
            <p>Inicia sesión: los docentes van a crear partidas y los estudiantes a unirse. Tu rol ya está guardado.</p>
            <span className="cp-tile-cta">Iniciar sesión</span>
          </button>
          <button type="button" className="cp-tile" onClick={onRegister}>
            <strong>Soy nuevo</strong>
            <p>Crea tu cuenta gratis en un minuto y elige si eres docente o estudiante.</p>
            <span className="cp-tile-cta">Crear cuenta</span>
          </button>
          <button type="button" className="cp-tile" onClick={onGuest}>
            <strong>Solo tengo un código</strong>
            <p>Únete a la partida de tu docente como invitado, sin crear cuenta.</p>
            <span className="cp-tile-cta">Entrar como invitado</span>
          </button>
        </div>

        <h2 className="cp-sec-title">Así se juega</h2>
        <ol className="ch-steps">
          {pasos.map((p) => (
            <li key={p.n} className="cp-card cp-step">
              <span>{String(p.n).padStart(2, "0")}</span>
              <strong>{p.t}</strong>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="cp-foot">
        <div className="cp-wrap"><span>YachayPlay · Build {BUILD_VERSION}</span></div>
      </footer>
    </div>
  );
}
