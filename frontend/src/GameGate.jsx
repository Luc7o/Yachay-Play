import React from "react";
import { Marca, BotonTema } from "./campusUi";
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
// Quita un emoji al inicio de un texto ("🏁 Carrera individual" → "Carrera individual"):
// el diseño "Campus" no usa emojis, pero así los textos que llegan por props siguen sirviendo.
const sinEmoji = (t) => (typeof t === "string" ? t.replace(/^[^\p{L}\p{N}]+/u, "").trim() : t);

export function GameGate({
  theme = "ludo",
  subtitle,
  eyebrow,
  title, // puede llevar <span className="gate-hl">…</span> para resaltar
  description,
  tags = [],
  stats = [], // [{ value, label }]
  mascot, // (ya no se muestra: diseño "Campus" sin mascota)
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
    <div className={`cp cp-landing gate2 gate-${theme}`}>
      <header className="cp-pubhead">
        <div className="cp-wrap">
          <Marca onClick={onBack} label="Volver al inicio de YachayPlay" />
          {subtitle && <span className="gate2-sub">{subtitle}</span>}
          <div className="cp-pubauth" style={{ marginLeft: "auto" }}>
            <BotonTema />
            <button type="button" className="cp-btn quiet" onClick={onBack}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ------------------------------ HERO ------------------------------ */}
        <section className="cp-wrap cp-hero gate2-hero" aria-labelledby="gate2-t">
          <div className="cp-hero-copy">
            <span className="cp-eyebrow accent" style={{ alignSelf: "flex-start" }}>
              {sinEmoji(eyebrow)}
            </span>
            <h1 id="gate2-t">{title}</h1>
            <p className="cp-hero-lead">{description}</p>
            {tags.length > 0 && (
              <ul className="gate2-tags">
                {tags.map((t) => (
                  <li key={t} className="cp-chip">
                    {sinEmoji(t)}
                  </li>
                ))}
              </ul>
            )}
            {stats.length > 0 && (
              <dl className="gate2-stats">
                {stats.map((st) => (
                  <div key={st.label}>
                    <dt>{st.value}</dt>
                    <dd>{st.label}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="cp-hero-art gate2-art" aria-hidden="true">
            <div className="gate2-preview">{preview}</div>
          </div>
        </section>

        {/* ------------------------- ENTRAR / CREAR CUENTA ------------------------- */}
        <section className="cp-section alt" aria-labelledby="gate2-entrar">
          <div className="cp-wrap">
            <div className="cp-section-head">
              <h2 id="gate2-entrar">Entra para jugar</h2>
              <p>Elige cómo quieres entrar. Solo te tomará un minuto.</p>
            </div>
            <div className="cp-grid">
              <div className="cp-card gate2-card">
                <strong>Ya tengo cuenta</strong>
                <p>Inicia sesión y entrarás directo a tu panel.</p>
                <ul>
                  {loginPoints.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <button type="button" className="cp-btn primary" onClick={onLogin}>
                  Iniciar sesión
                </button>
              </div>
              <div className="cp-card gate2-card">
                <strong>Soy nuevo</strong>
                <p>Crea tu cuenta gratis y empieza a jugar.</p>
                <ul>
                  {registerPoints.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
                <button type="button" className="cp-btn ghost" onClick={onRegister}>
                  Crear cuenta
                </button>
              </div>
              <div className="cp-card gate2-card">
                <strong>{guestText}</strong>
                <p>Entra sin cuenta con los 6 dígitos que proyecta tu docente.</p>
                <ul>
                  <li>No necesitas registrarte</li>
                  <li>La partida no queda en un historial</li>
                </ul>
                <button type="button" className="cp-btn ghost" onClick={onGuest}>
                  Entrar como invitado
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------- CÓMO SE JUEGA ----------------------------- */}
        {steps.length > 0 && (
          <section className="cp-section" aria-labelledby="gate2-pasos">
            <div className="cp-wrap">
              <div className="cp-section-head">
                <h2 id="gate2-pasos">{stepsTitle}</h2>
              </div>
              <ol className="ch-steps">
                {steps.map((st, k) => (
                  <li key={st.t} className="cp-card cp-step">
                    <span>{String(k + 1).padStart(2, "0")}</span>
                    <strong>{st.t}</strong>
                    <p>{st.d}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {extra && (
          <section className="cp-section alt gate2-extra">
            <div className="cp-wrap">{extra}</div>
          </section>
        )}
      </main>

      {footer && (
        <footer className="cp-foot">
          <div className="cp-wrap">
            <span>{footer}</span>
          </div>
        </footer>
      )}
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
        <span className="pv-dice" aria-hidden="true">
          6
        </span>
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
  [2, 0, "R", 1, 1],
  [2, 1, "A", 0, 1],
  [2, 2, "D", 0, 1],
  [2, 3, "I", 0, 1],
  [2, 4, "O", 0, 1],
  [1, 1, "V", 2, 1],
  [3, 1, "P", 0, 1],
  [4, 1, "O", 0, 0],
  [5, 1, "R", 0, 0],
  [1, 4, "M", 3, 1],
  [3, 4, "T", 0, 0],
  [4, 4, "O", 0, 0],
  [5, 4, "R", 0, 0],
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
        </span>,
      );
    }
  }
  return (
    <div className="pv-cw">
      <div className="pv-cw-board">{celdas}</div>
      <p className="pv-clue">
        <b>2 ↓</b> Máquina de Watt que impulsó la industria
      </p>
      <div className="pv-energy">
        <span>Energía</span>
        <span className="pv-energy-bar">
          <i />
        </span>
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
  { icon: "", name: "Congelar", cost: 35, text: "El rival no puede responder por 5 segundos." },
  { icon: "", name: "Niebla", cost: 25, text: "Le ocultas sus pistas por 6 segundos." },
  { icon: "", name: "Robar puntos", cost: 50, text: "Le quitas hasta 40 puntos." },
];

export function CrosswordSabotagesExtra() {
  return (
    <>
      <h2 className="gate-h2">Acierta rápido y sabotea a tus rivales</h2>
      <p className="gate-sub">Cada acierto en racha llena tu energía. Gástala cuando más te convenga.</p>
      <div className="gate-sabs">
        {SABOTAJES.map((s) => (
          <div key={s.name} className="gate-sab">
            <strong>{s.name}</strong>
            <p>{s.text}</p>
            <span className="gate-sab-cost">{s.cost} de energía</span>
          </div>
        ))}
      </div>
    </>
  );
}
