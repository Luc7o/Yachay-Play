import React from "react";
import { Brand } from "./Brand";
import "./gate.css";

// ============================================================================
// PUERTA DE ENTRADA DE UN JUEGO (la pantalla que se ve al elegir Ludo o Crucigrama)
// ============================================================================
// Un solo componente para todos los juegos: así todas las puertas se ven con la
// misma calidad y, para agregar un juego nuevo, solo hay que pasarle sus textos
// y su "vista previa". Los colores y el tono de cada juego salen de `theme`
// ("ludo" | "crossword") y viven en gate.css.
//
// No sabe nada de sesiones ni de sockets: solo avisa con onLogin / onRegister /
// onGuest / onBack, igual que las pantallas que reemplaza.
// ============================================================================
export function GameGate({
  theme = "ludo",
  subtitle,
  eyebrow,
  title, // puede llevar <span className="gate-hl">…</span> para resaltar
  description,
  tags = [],
  stats = [], // [{ value, label }]
  mascot, // { src, alt }
  preview, // vista previa del juego (LudoPreview / CrosswordPreview)
  loginPoints = [],
  registerPoints = [],
  guestText = "¿Solo quieres unirte con el código de tu docente?",
  stepsTitle = "Así se juega",
  steps = [], // [{ icon, t, d }]
  extra, // sección opcional al final (equipos, sabotajes…)
  footer,
  onLogin,
  onRegister,
  onGuest,
  onBack,
}) {
  return (
    <div className={`app gate-page gate-${theme}`}>
      <header className="ref-topbar">
        <Brand subtitle={subtitle} onClick={onBack} />
      </header>

      <main className="gate-main">
        <button className="back-link" onClick={onBack}>← Volver al inicio</button>

        {/* ------------------------------ HERO ------------------------------ */}
        <section className="gate-hero">
          <div className="gate-hero-text">
            <span className="gate-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
            <div className="gate-tags">
              {tags.map((t) => <span key={t}>{t}</span>)}
            </div>
            {stats.length > 0 && (
              <dl className="gate-stats">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt>{s.value}</dt>
                    <dd>{s.label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="gate-stage">
            <span className="gate-orb o1" aria-hidden="true" />
            <span className="gate-orb o2" aria-hidden="true" />
            <span className="gate-orb o3" aria-hidden="true" />
            <div className="gate-stage-card" aria-hidden="true">{preview}</div>
            {mascot && <img className="gate-mascot" src={mascot.src} alt={mascot.alt} />}
          </div>
        </section>

        {/* ------------------------- ENTRAR / CREAR CUENTA ------------------------- */}
        <h2 className="gate-h2">Entra a tu cuenta para jugar</h2>
        <p className="gate-sub">Elige cómo quieres entrar. Solo te tomará un minuto.</p>

        <div className="gate-cards">
          <article className="gate-card gate-card-login" onClick={onLogin}>
            <span className="gate-card-icon" aria-hidden="true">🔑</span>
            <strong>Ya tengo cuenta</strong>
            <span className="gate-card-desc">Inicia sesión y entrarás directo a tu panel.</span>
            <ul className="gate-points">
              {loginPoints.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <button type="button" className="gate-card-cta">Iniciar sesión →</button>
          </article>

          <article className="gate-card gate-card-register" onClick={onRegister}>
            <span className="gate-card-icon" aria-hidden="true">✨</span>
            <strong>Soy nuevo</strong>
            <span className="gate-card-desc">Crea tu cuenta gratis y empieza a jugar.</span>
            <ul className="gate-points">
              {registerPoints.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <button type="button" className="gate-card-cta">Crear cuenta →</button>
          </article>
        </div>

        <div className="gate-guest">
          <div className="gate-guest-code" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => <i key={i}>{i === 0 ? "" : "•"}</i>)}
          </div>
          <div className="gate-guest-text">
            <strong>{guestText}</strong>
            <small>Entra sin cuenta con los 6 dígitos que proyecta tu docente.</small>
          </div>
          <button type="button" onClick={onGuest}>Entrar como invitado →</button>
        </div>

        {/* ----------------------------- CÓMO SE JUEGA ----------------------------- */}
        {steps.length > 0 && (
          <>
            <h2 className="gate-h2">{stepsTitle}</h2>
            <ol className="gate-steps">
              {steps.map((s, i) => (
                <li key={s.t}>
                  <span className="gate-step-n">{i + 1}</span>
                  <span className="gate-step-icon" aria-hidden="true">{s.icon}</span>
                  <strong>{s.t}</strong>
                  <p>{s.d}</p>
                </li>
              ))}
            </ol>
          </>
        )}

        {extra}
      </main>

      {footer && <footer className="build-mark">{footer}</footer>}
    </div>
  );
}

// ============================================================================
// VISTAS PREVIAS (decorativas: no son interactivas)
// ============================================================================

const EQUIPOS = [
  { name: "Rojo", c: "#ef4444", s: "#fee2e2" },
  { name: "Verde", c: "#10b981", s: "#d1fae5" },
  { name: "Azul", c: "#3b82f6", s: "#dbeafe" },
  { name: "Amarillo", c: "#eab308", s: "#fef3c7" },
];

// Mini tablero de Ludo: cuatro casas de color, una ficha que "salta" en cada una y un dado.
export function LudoPreview() {
  return (
    <div className="pv-ludo">
      <div className="pv-board">
        {EQUIPOS.map((t, i) => (
          <div key={t.name} className="pv-home" style={{ "--c": t.c, "--s": t.s }}>
            {[0, 1, 2, 3].map((k) => (
              <span
                key={k}
                className={"pv-slot" + (k === 0 ? " tok" : "")}
                style={k === 0 ? { animationDelay: `${i * 0.4}s` } : undefined}
              />
            ))}
          </div>
        ))}
        <span className="pv-goal">META</span>
      </div>
      <div className="pv-bar">
        <span className="pv-dice">🎲</span>
        <span>
          <b>¡Responde y avanza!</b>
          <small>Solo avanzas si aciertas</small>
        </span>
      </div>
    </div>
  );
}

// Mini crucigrama con las palabras RADIO, VAPOR y MOTOR (que sí están en el banco del juego).
// [fila, columna, letra, número de pista, ¿ya escrita?]
const CW_CELDAS = [
  [2, 0, "R", 1, 1], [2, 1, "A", 0, 1], [2, 2, "D", 0, 1], [2, 3, "I", 0, 1], [2, 4, "O", 0, 1],
  [1, 1, "V", 2, 1], [3, 1, "P", 0, 1], [4, 1, "O", 0, 0], [5, 1, "R", 0, 0],
  [1, 4, "M", 3, 1], [3, 4, "T", 0, 0], [4, 4, "O", 0, 0], [5, 4, "R", 0, 0],
];
const CW_ACTIVA = "4-1"; // la casilla que "se está escribiendo"

export function CrosswordPreview() {
  const celdas = [];
  let orden = 0;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 5; c++) {
      const d = CW_CELDAS.find((x) => x[0] === r && x[1] === c);
      if (!d) {
        celdas.push(<span key={`${r}-${c}`} className="pv-cell gap" />);
        continue;
      }
      const [, , letra, num, escrita] = d;
      const activa = `${r}-${c}` === CW_ACTIVA;
      celdas.push(
        <span key={`${r}-${c}`} className={"pv-cell" + (escrita ? " on" : "") + (activa ? " hot" : "")}>
          {num > 0 && <em>{num}</em>}
          {escrita ? <b style={{ "--d": `${0.25 + orden++ * 0.13}s` }}>{letra}</b> : null}
        </span>
      );
    }
  }
  return (
    <div className="pv-cw">
      <div className="pv-cw-board">{celdas}</div>
      <p className="pv-clue"><b>2 ↓</b> Máquina de Watt que impulsó la industria</p>
      <div className="pv-energy">
        <span>⚡ Energía</span>
        <span className="pv-energy-bar"><i /></span>
      </div>
    </div>
  );
}

// ============================================================================
// SECCIONES EXTRA (se pasan por la prop `extra`)
// ============================================================================

// Ludo: los cuatro colores de equipo.
export function LudoTeamsExtra() {
  return (
    <>
      <h2 className="gate-h2">Elige el color de tu equipo</h2>
      <p className="gate-sub">Cada equipo juega con su color y su ficha solo avanza cuando acierta.</p>
      <div className="gate-teams">
        {EQUIPOS.map((t) => (
          <span key={t.name} className="gate-team" style={{ "--c": t.c, "--s": t.s }}>
            <i />
            {t.name}
          </span>
        ))}
      </div>
    </>
  );
}

// Crucigrama: los tres sabotajes (mismos costos y duraciones que el motor del juego).
const SABOTAJES = [
  { icon: "🧊", name: "Congelar", cost: 35, text: "El rival no puede responder por 5 segundos." },
  { icon: "🌫️", name: "Niebla", cost: 25, text: "Le ocultas sus pistas por 6 segundos." },
  { icon: "💰", name: "Robar puntos", cost: 50, text: "Le quitas hasta 40 puntos." },
];

export function CrosswordSabotagesExtra() {
  return (
    <>
      <h2 className="gate-h2">Acierta rápido y sabotea a tus rivales</h2>
      <p className="gate-sub">Cada acierto en racha llena tu energía. Gástala cuando más te convenga.</p>
      <div className="gate-sabs">
        {SABOTAJES.map((s) => (
          <div key={s.name} className="gate-sab">
            <span className="gate-sab-icon" aria-hidden="true">{s.icon}</span>
            <strong>{s.name}</strong>
            <p>{s.text}</p>
            <span className="gate-sab-cost">⚡ {s.cost} de energía</span>
          </div>
        ))}
      </div>
    </>
  );
}
