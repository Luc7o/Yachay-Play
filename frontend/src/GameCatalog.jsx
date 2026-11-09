import { PublicAulaHeader } from "./PublicAulaHeader";
import "./publicAula.css";
import React from "react";
import { CwGridIcon } from "./Crossword";
import { AppShell } from "./AppShell";

// ============================================================================
// CATÁLOGO DE JUEGOS DE YACHAYPLAY
// ============================================================================
// Para agregar un juego nuevo basta con añadir un objeto a esta lista.
//   id        -> identificador interno
//   name      -> nombre visible bajo el ícono
//   available -> true si ya se puede jugar; false muestra "Próximamente"
//   icon      -> emoji (o el string "ludo" para usar el mini tablero dibujado)
//   bg        -> degradado de fondo del ícono
// ============================================================================

// ============================================================================
// TEXTOS DE LA PORTADA (edítalos aquí, sin tocar el diseño)
// ============================================================================
export const HERO = {
  eyebrow: "APRENDER JUGANDO",
  title: "Convierte tu clase en una experiencia de juego",
  text:
    "YachayPlay es una plataforma de juegos educativos para el aula. El docente crea una partida y proyecta el código; los estudiantes se unen desde su celular, responden preguntas y compiten por equipos mientras aprenden.",
  quechua: "“Yachay” significa aprender y saber en quechua.",
  // Ideas que queremos transmitir (ícono, título, descripción)
  values: [
    { icon: "🎯", title: "Aprender con propósito", text: "Cada respuesta correcta te hace avanzar: se refuerzan los conceptos mientras se juega." },
    { icon: "🤝", title: "Trabajo en equipo", text: "Los estudiantes conversan, deciden juntos y se apoyan para llegar a la meta." },
    { icon: "📱", title: "Sin instalar nada", text: "Basta con un código y un celular conectado a la misma red." },
  ],
};

export const GAMES = [
  { id: "ludo", name: "Ludo Educativo", desc: "Tablero por equipos: responde preguntas, lanza el dado y llega primero a la meta.", available: true, icon: "ludo", bg: "linear-gradient(145deg,#0A4C8F,#023A73)" },
  { id: "crucigrama", name: "Crucigrama Relámpago", desc: "Cada estudiante resuelve su crucigrama contra el reloj y puede sabotear a sus rivales.", tag: "Nuevo", available: true, icon: "crucigrama", bg: "linear-gradient(145deg,#023A73,#0A4C8F)" },
  { id: "palabra", name: "Palabra Relámpago", desc: "Forma palabras con las letras indicadas antes de que se acabe el tiempo. Compite por equipos.", tag: "Nuevo", available: true, icon: "⚡", bg: "linear-gradient(145deg,#00A996,#087A77)" },
  { id: "quiz", name: "Quiz", desc: "Preguntas de opción múltiple para toda la clase.", available: false, icon: "❓", bg: "linear-gradient(145deg,#00B39D,#087A77)" },
  { id: "sino", name: "Sí o No", desc: "Afirmaciones que se responden con verdadero o falso.", available: false, icon: "✅", bg: "linear-gradient(145deg,#0A4C8F,#2B6AA8)" },
  { id: "adivinanza", name: "Adivinanza", desc: "Pistas que los estudiantes deben descifrar.", available: false, icon: "🔮", bg: "linear-gradient(145deg,#F16503,#ff9a4d)" },
  { id: "relacionar", name: "Relacionar grupos", desc: "Une cada concepto con su categoría o definición.", available: false, icon: "🧩", bg: "linear-gradient(145deg,#023A73,#2B6AA8)" },
  { id: "sopa", name: "Sopa de letras", desc: "Encuentra las palabras escondidas en la cuadrícula.", available: false, icon: "🔤", bg: "linear-gradient(145deg,#D45500,#F16503)" },
  { id: "memoria", name: "Memoria", desc: "Encuentra las parejas de cartas iguales.", available: false, icon: "🧠", bg: "linear-gradient(145deg,#2B6AA8,#0A4C8F)" },
  { id: "ordenar", name: "Ordenar frases", desc: "Ordena las palabras para formar la frase correcta.", available: false, icon: "🔢", bg: "linear-gradient(145deg,#00B39D,#087A77)" },
];

// Herramientas para el docente. Cada una es un componente de React (Cronometro.jsx,
// Ruleta.jsx, Pizarra.jsx) que App.jsx muestra al elegirla, igual que Ludo y el Crucigrama.
// Para agregar otra: crea su componente, añádelo aquí y agrega su pantalla en App.jsx.
export const TOOLS = [
  { id: "cronometro", name: "Cronómetro de actividad", desc: "Controla el tiempo de una actividad y proyéctalo en pantalla.", icon: "⏱️", bg: "linear-gradient(145deg,#00B39D,#087A77)" },
  { id: "ruleta", name: "Ruleta de sorteos", desc: "Sortea estudiantes o equipos con una ruleta animada.", icon: "🎡", bg: "linear-gradient(145deg,#0A4C8F,#023A73)" },
  { id: "pizarra", name: "Pizarra", desc: "Dibuja y explica en vivo sobre una pizarra digital.", icon: "🖍️", bg: "linear-gradient(145deg,#2B6AA8,#0A4C8F)" },
];

// Mini tablero de Ludo dibujado en SVG (ícono del juego disponible)
export function LudoIcon() {
  return (
    <svg viewBox="0 0 100 100" className="game-icon-svg" aria-hidden="true">
      <rect x="10" y="10" width="36" height="36" rx="8" fill="#ef4444" />
      <rect x="54" y="10" width="36" height="36" rx="8" fill="#10b981" />
      <rect x="54" y="54" width="36" height="36" rx="8" fill="#eab308" />
      <rect x="10" y="54" width="36" height="36" rx="8" fill="#3b82f6" />
      <circle cx="28" cy="28" r="9" fill="#fff" />
      <circle cx="72" cy="28" r="9" fill="#fff" />
      <circle cx="72" cy="72" r="9" fill="#fff" />
      <circle cx="28" cy="72" r="9" fill="#fff" />
      <rect x="42" y="42" width="16" height="16" rx="4" fill="#009F91" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}

// Tarjeta de un juego o herramienta (icono + nombre + descripción corta)
function GameCard({ item, onSelect }) {
  const soon = item.available === false;
  return (
    <button className={"gc" + (soon ? " gc-soon" : "")} onClick={() => !soon && onSelect(item.id)} disabled={soon}>
      <span className="gc-icon" style={{ background: item.bg }}>
        {item.icon === "ludo" ? <LudoIcon /> : item.icon === "crucigrama" ? <CwGridIcon /> : <span className="gc-emoji">{item.icon}</span>}
      </span>
      <span className="gc-body">
        {soon ? (
          <span className="gc-tag gc-tag-soon">Próximamente</span>
        ) : item.tag ? (
          <span className="gc-tag gc-tag-nuevo">{item.tag}</span>
        ) : null}
        <strong>{item.name}</strong>
        <small>{item.desc}</small>
      </span>
    </button>
  );
}

// Secciones "Juegos" y "Herramientas" (las comparten el inicio con sesión y la portada)
function GamesSection({ onSelectGame, esEstudiante, showTools }) {
  return (
    <>
      <section id="juegos">
        <div className="sec-head">
          <h2>Selecciona un juego</h2>
          <p>
            {esEstudiante
              ? "Estos son los juegos de YachayPlay. Tu docente crea la partida y te da un código para entrar."
              : "Elige un juego para crear una partida con tus estudiantes."}
          </p>
        </div>
        <div className="gc-grid">
          {GAMES.map((g) => (
            <GameCard key={g.id} item={g} onSelect={onSelectGame} />
          ))}
        </div>
      </section>

      {/* Herramientas para dar la clase en vivo (no se muestran a estudiantes) */}
      {showTools && (
        <section id="herramientas" aria-labelledby="tools-title">
          <div className="sec-head">
            <h2 id="tools-title">Herramientas para docentes</h2>
            <p>Para dar tu clase en vivo y proyectar la pantalla. No necesitan cuenta.</p>
          </div>
          <div className="gc-grid">
            {TOOLS.map((t) => (
              <GameCard key={t.id} item={t} onSelect={onSelectGame} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ---- Diseño "Aula Fresca": textos y símbolos de las tarjetas del inicio ----
const CATALOGO = [
  { id: "ludo", glyph: "⚄", name: "Ludo Educativo", desc: "Tablero por equipos: preguntas, dados y llegar a la meta.", ok: true },
  { id: "crucigrama", glyph: "▦", name: "Crucigrama Relámpago", desc: "Resuelve el crucigrama contra el reloj y compite con tus rivales.", ok: true },
  { id: "palabra", glyph: "⚡", name: "Palabra Relámpago", desc: "Completa letras, compite por puntos y gana antes de que se acabe el tiempo.", ok: true },
  { id: "quiz", glyph: "❓", name: "Quiz", desc: "Preguntas de opción múltiple." },
  { id: "sino", glyph: "✓", name: "Sí o No", desc: "Afirmaciones de verdadero o falso." },
  { id: "adivinanza", glyph: "✦", name: "Adivinanza", desc: "Pistas para descifrar conceptos." },
  { id: "relacionar", glyph: "▤", name: "Relacionar grupos", desc: "Une conceptos con categorías." },
  { id: "sopa", glyph: "🔤", name: "Sopa de letras", desc: "Encuentra palabras escondidas." },
  { id: "memoria", glyph: "◈", name: "Memoria", desc: "Encuentra parejas de cartas." },
  { id: "ordenar", glyph: "☷", name: "Ordenar frases", desc: "Ordena palabras para formar frases." },
];
const HERRAMIENTAS = [
  { id: "cronometro", glyph: "⏱", name: "Cronómetro de actividad", desc: "Controla la duración de ejercicios y dinámicas.", boton: "Abrir cronómetro", color: "" },
  { id: "ruleta", glyph: "◉", name: "Ruleta de sorteos", desc: "Elige estudiantes o equipos al azar.", boton: "Abrir ruleta", color: "blue" },
  { id: "pizarra", glyph: "✎", name: "Pizarra digital", desc: "Explica ideas y conceptos visualmente.", boton: "Abrir pizarra", color: "yellow" },
];

// Inicio con sesión iniciada. `section` (inicio | juegos | herramientas) la maneja App.jsx
// para que el menú de arriba funcione igual desde cualquier pantalla.
function HomeLogged({ onSelectGame, buildVersion, user, onLogout, onNavigate, section = "inicio" }) {
  const esDocente = user.role === "docente";
  const primerNombre = user.name.split(" ")[0];
  const activo = section === "inicio" ? "home" : section;

  const vistas = {
    inicio: (
      <>
        <div className="dh-grid">
          <section className="dh-hero">
            <div className="dh-text">
              <div className="dh-eyebrow">Hola, {primerNombre}</div>
              <h1>{esDocente ? "Que tus estudiantes aprendan jugando." : "¿Listo para jugar?"}</h1>
              <p>
                {esDocente
                  ? "Crea una partida, proyecta el código y se unen desde su celular."
                  : "Ingresa el código que muestra tu docente y compite con tu equipo."}
              </p>
              <div className="dh-actions">
                {esDocente ? (
                  <>
                    <button className="dh-white" onClick={() => onSelectGame("ludo")}>Crear partida de Ludo</button>
                    <button className="dh-outline" onClick={() => onSelectGame("crucigrama")}>Crear crucigrama</button>
                  </>
                ) : (
                  <>
                    <button className="dh-white" onClick={() => onNavigate("join")}>Unirme con código</button>
                    <button className="dh-outline" onClick={() => onNavigate("stats")}>Mis resultados</button>
                  </>
                )}
              </div>
            </div>
            <img className="dh-mascot" src="/mascota-explica.png" alt="Mascota dragón de YachayPlay" />
          </section>

          <div className="dh-side">
            <button className="dh-info" onClick={() => onNavigate("stats")}>
              <span className="dh-ico">▥</span>
              <h3>{esDocente ? "Estadísticas" : "Mis resultados"}</h3>
              <p>{esDocente ? "Mira quién ganó y qué preguntas cuestan más." : "Revisa cómo te ha ido en tus partidas."}</p>
            </button>
            <button className="dh-info" onClick={() => onNavigate(esDocente ? "questions" : "profile")}>
              <span className="dh-ico yellow">▣</span>
              <h3>{esDocente ? "Mis preguntas" : "Mi perfil"}</h3>
              <p>{esDocente ? "Crea y ordena tu propio banco de preguntas." : "Mira tus insignias y tu posición."}</p>
            </button>
          </div>
        </div>

        <div className="dh-sectionhead">
          <h2>Elige un juego</h2>
        </div>
        <div className="dh-games">
          <button className="dh-feature dh-blue" onClick={() => onSelectGame("ludo")}>
            <span className="dh-glyph" aria-hidden="true">⚄</span>
            <div>
              <h3>Ludo Educativo</h3>
              <p>Equipos, dado y preguntas: gana quien llega primero a la meta.</p>
            </div>
            <span className="dh-chip">{esDocente ? "Crear partida" : "Ver el juego"}</span>
          </button>
          <button className="dh-feature dh-mint" onClick={() => onSelectGame("crucigrama")}>
            <span className="dh-glyph" aria-hidden="true">＃</span>
            <div>
              <h3>
                Crucigrama Relámpago <span className="dh-tag">NUEVO</span>
              </h3>
              <p>Contra el reloj, con sabotajes entre rivales.</p>
            </div>
            <span className="dh-chip dark">{esDocente ? "Crear crucigrama" : "Ver el juego"}</span>
          </button>
        </div>
        <div className="dh-soonrow">
          {["Quiz", "Sopa de letras", "Memoria", "Ordenar frases"].map((n) => (
            <div className="dh-soon" key={n}>
              <strong>{n}</strong>
              <span>Próximamente</span>
            </div>
          ))}
        </div>
      </>
    ),

    juegos: (
      <>
        <div className="dh-pagehead">
          <h1>Juegos educativos</h1>
          <p>Selecciona una actividad para reforzar lo aprendido en clase.</p>
        </div>
        <div className="dh-catalog">
          {CATALOGO.map((g, i) => (
            <article className="dh-card" key={g.id}>
              <div className={"dh-ico" + (i % 3 === 1 ? " blue" : i % 3 === 2 ? " yellow" : "")} aria-hidden="true">{g.glyph}</div>
              <h3>{g.name}</h3>
              <p>{g.desc}</p>
              <button className="dh-flat" disabled={!g.ok} onClick={() => g.ok && onSelectGame(g.id)}>
                {g.ok ? (esDocente ? "Crear partida" : "Ver el juego") : "Próximamente"}
              </button>
            </article>
          ))}
        </div>
      </>
    ),

    herramientas: (
      <>
        <div className="dh-pagehead">
          <h1>Herramientas para tu clase</h1>
          <p>Cronómetro, ruleta y pizarra para dar tu clase en vivo. No necesitan cuenta.</p>
        </div>
        <div className="dh-tools">
          {HERRAMIENTAS.map((t) => (
            <div className="dh-toolcard" key={t.id}>
              <span className={"dh-ico " + t.color} aria-hidden="true">{t.glyph}</span>
              <h3>{t.name}</h3>
              <p>{t.desc}</p>
              <button className="dh-flat" onClick={() => onSelectGame(t.id)}>{t.boton}</button>
            </div>
          ))}
        </div>
      </>
    ),
  };

  return (
    <AppShell user={user} active={activo} onNavigate={onNavigate} onLogout={onLogout} buildVersion={buildVersion}>
      {vistas[section === "herramientas" && !esDocente ? "inicio" : section] || vistas.inicio}
    </AppShell>
  );
}

// Portada pública Aula Fresca; reutiliza callbacks y recursos del proyecto.
function Landing({ onSelectGame, onJoinWithCode, buildVersion, onLogin, onRegister }) {
  const pages = ["inicio", "juegos", "caracteristicas", "como-funciona", "planes", "contacto"];
  const getPage = () => { const raw = window.location.hash.replace(/^#\/?/, "").split("?")[0]; return pages.includes(raw) ? raw : "inicio"; };
  const [page, setPage] = React.useState(getPage);
  React.useEffect(() => {
    const listener = () => { setPage(getPage()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  const benefits = [
    { icon: "♧", title: "Juegos interactivos", text: "Ludo, crucigramas y más." },
    { icon: "♙", title: "Para docentes y estudiantes", text: "Crea, comparte y participa." },
    { icon: "▥", title: "Seguimiento de resultados", text: "Analiza el progreso de tu clase." },
    { icon: "ϟ", title: "Fácil de usar", text: "Sin instalaciones, desde tu navegador." },
  ];
  const steps = [
    { icon: "♙", title: "Crea tu cuenta", text: "Regístrate como docente o estudiante." },
    { icon: "▱", title: "Crea tu actividad", text: "Elige un juego y prepara las preguntas." },
    { icon: "♧", title: "Juega con tu clase", text: "Comparte el código y aprendan juntos." },
  ];
  const games = [
    { id: "ludo", icon: "⚄", name: "Ludo Educativo", description: "Equipos, dado y preguntas: gana quien llega primero a la meta.", available: true },
    { id: "crucigrama", icon: "＃", name: "Crucigrama Relámpago", description: "Contra el reloj, con sabotajes entre rivales.", available: true, isNew: true },
    { id: "palabra", icon: "⚡", name: "Palabra Relámpago", description: "Crea palabras en segundos y gana puntos por equipos.", available: true, isNew: true },
    { id: "quiz", icon: "?", name: "Quiz", description: "Responde preguntas y suma puntos.", available: false },
    { id: "sino", icon: "✓", name: "Sí o No", description: "Decide si cada afirmación es verdadera o falsa.", available: false },
  ];
  return (
    <div className="app catalog-page public-aula">
      <PublicAulaHeader activePage={page} onLogin={onLogin} onRegister={onRegister} />
      <main>
        {page === "inicio" && <>
          <section id="inicio" className="pa-intro">
            <div className="pa-hero">
              <div className="pa-hero-copy">
                <span className="pa-pill">APRENDER JUGANDO</span>
                <h1>Juegos educativos<br />para tus <em>clases</em><span className="pa-spark" aria-hidden="true">✳</span></h1>
                <p>Crea actividades divertidas, organiza tus clases y motiva a tus estudiantes con juegos interactivos como Ludo, Crucigramas y más.</p>
                <div className="pa-actions">
                  <button className="pa-primary" onClick={onRegister}>Crear cuenta gratis</button>
                  <a className="pa-secondary" href="#/como-funciona">Conocer YachayPlay</a>
                </div>
                <button className="pa-join" onClick={onJoinWithCode}>¿Ya tienes un código de partida? <strong>Únete aquí →</strong></button>
              </div>
              <div className="pa-art">
                <div className="pa-art-glow" />
                <div className="pa-art-panel" aria-hidden="true"><span>Yachay<span>Play</span></span><div className="pa-art-tiles"><b>⚄</b><b>＃</b><b>?</b><b>★</b></div></div>
                <img src="/mascota-explica.png" alt="Dragón andino, mascota de YachayPlay" />
              </div>
            </div>
          </section>

          <section className="pa-home-benefits" aria-label="Ventajas de YachayPlay">
            <div className="pa-benefits">
              {benefits.map((item, i) => <div className="pa-benefit" key={item.title}><span className={'pa-benefit-icon pa-benefit-' + i} aria-hidden="true">{item.icon}</span><div><strong>{item.title}</strong><p>{item.text}</p></div></div>)}
            </div>
          </section>

          <section className="pa-games pa-home-games" aria-labelledby="pa-home-games-title">
            <div className="pa-games-heading pa-home-heading">
              <div><span className="pa-overline">DIVIÉRTETE APRENDIENDO</span><h2 id="pa-home-games-title">Descubre nuestros juegos</h2><p>Actividades para practicar, colaborar y aprender en equipo.</p></div>
              <a href="#/juegos" className="pa-text-link">Ver todos los juegos →</a>
            </div>
            <div className="pa-game-grid">
              {games.map((g, i) => <article className={'pa-game pa-game-' + (g.id === 'palabra' ? 'word' : g.available ? i : 'soon')} key={g.id}>
                <span className="pa-game-icon" aria-hidden="true">{g.icon}</span>{g.isNew && <span className="pa-new">NUEVO</span>}
                <h3>{g.name}</h3><p>{g.description}</p>
                {g.available ? <button onClick={() => onSelectGame(g.id)}>Ver juego</button> : <span className="pa-coming">Próximamente</span>}
              </article>)}
            </div>
          </section>

          <section className="pa-home-features" aria-labelledby="pa-home-features-title">
            <div className="pa-home-heading pa-home-features-top">
              <div><span className="pa-overline">PENSADO PARA TU AULA</span><h2 id="pa-home-features-title">Más que juegos, experiencias de aprendizaje</h2><p>Una forma cercana y dinámica de convertir la participación en aprendizaje.</p></div>
              <a href="#/caracteristicas" className="pa-text-link">Explorar características →</a>
            </div>
            <div className="pa-home-feature-grid">
              <article><span className="pa-home-feature-icon">🎯</span><h3>Aprende con propósito</h3><p>Refuerza conceptos con preguntas y desafíos durante cada partida.</p></article>
              <article><span className="pa-home-feature-icon">🤝</span><h3>Participación en equipo</h3><p>Promueve la colaboración y la participación activa de los estudiantes.</p></article>
              <article><span className="pa-home-feature-icon">📊</span><h3>Revisa los resultados</h3><p>Consulta las estadísticas disponibles de las actividades y partidas.</p></article>
            </div>
          </section>

          <section className="pa-how pa-home-how" aria-labelledby="pa-home-how-title">
            <span className="pa-overline">TRES PASOS PARA EMPEZAR</span>
            <h2 id="pa-home-how-title">¿Cómo funciona?</h2>
            <p className="pa-how-subtitle">Crea una actividad, comparte el código y aprende junto a tu clase.</p>
            <div className="pa-steps">
              {steps.map((step, i) => <React.Fragment key={step.title}>
                {i > 0 && <span className="pa-step-arrow" aria-hidden="true">→</span>}
                <div className="pa-step"><span className="pa-step-icon" aria-hidden="true">{step.icon}</span><div><h3>{i + 1}. {step.title}</h3><p>{step.text}</p></div></div>
              </React.Fragment>)}
            </div>
            <a className="pa-text-link pa-home-how-link" href="#/como-funciona">Ver la guía completa →</a>
          </section>

          <section className="pa-home-cta" aria-labelledby="pa-home-cta-title">
            <div><span className="pa-home-cta-label">TU PRÓXIMA CLASE PUEDE SER DIFERENTE</span><h2 id="pa-home-cta-title">¿Listo para aprender jugando?</h2><p>Explora YachayPlay y empieza a preparar tu próxima actividad educativa.</p></div>
            <div className="pa-home-cta-actions"><button className="pa-primary" onClick={onRegister}>Crear mi cuenta</button><button className="pa-cta-join" onClick={onJoinWithCode}>Tengo un código de partida →</button></div>
          </section>
        </>}
        {page === "caracteristicas" && <section className="pa-subpage"><div className="pa-pagehead"><span className="pa-overline">NUESTRA PLATAFORMA</span><h1>Todo lo que necesitas para aprender jugando</h1><p>Actividades entretenidas, participación en equipo y resultados para mejorar cada clase.</p></div>          <div className="pa-benefits">
            {benefits.map((item, i) => <div className="pa-benefit" key={item.title}><span className={'pa-benefit-icon pa-benefit-' + i} aria-hidden="true">{item.icon}</span><div><strong>{item.title}</strong><p>{item.text}</p></div></div>)}
          </div>
<div className="pa-feature-grid"><article><strong>🎲 Ludo Educativo</strong><p>Los equipos avanzan respondiendo preguntas y colaborando.</p></article><article><strong>▦ Crucigrama Relámpago</strong><p>Desafíos de palabras y conceptos para competir contra el reloj.</p></article><article><strong>📊 Resultados de aprendizaje</strong><p>Consulta las estadísticas disponibles y aprende de cada partida.</p></article></div></section>}
        {page === "como-funciona" && <section id="como-funciona" className="pa-how">
          <span className="pa-overline">SENCILLO Y DIVERTIDO</span>
          <h2>¿Cómo funciona?</h2>
          <p className="pa-how-subtitle">En solo 3 pasos, crea una experiencia de aprendizaje divertida para tu clase.</p>
          <div className="pa-steps">
            {steps.map((step, i) => <React.Fragment key={step.title}>
              {i > 0 && <span className="pa-step-arrow" aria-hidden="true">→</span>}
              <div className="pa-step"><span className="pa-step-icon" aria-hidden="true">{step.icon}</span><div><h3>{i + 1}. {step.title}</h3><p>{step.text}</p></div></div>
            </React.Fragment>)}
          </div>
        </section>}
        {page === "juegos" && <section id="juegos" className="pa-games">
          <div className="pa-games-heading"><div><span className="pa-overline">APRENDER ES JUGAR</span><h2>Elige un juego</h2><p>Descubre las actividades disponibles para tus clases.</p></div></div>
          <div className="pa-game-grid">
            {games.map((g, i) => <article className={'pa-game pa-game-' + (g.id === 'palabra' ? 'word' : g.available ? i : 'soon')} key={g.id}>
              <span className="pa-game-icon" aria-hidden="true">{g.icon}</span>{g.isNew && <span className="pa-new">NUEVO</span>}
              <h3>{g.name}</h3><p>{g.description}</p>
              {g.available ? <button onClick={() => onSelectGame(g.id)}>Ver juego</button> : <span className="pa-coming">Próximamente</span>}
            </article>)}
          </div>
          <div className="pa-bottom-join"><span>¿Tu docente compartió un código?</span><button onClick={onJoinWithCode}>Unirme a una partida →</button></div>
        </section>}
        {page === "planes" && <section className="pa-subpage"><div className="pa-pagehead"><span className="pa-overline">PLANES Y ACCESO</span><h1>Una forma sencilla de llevar el juego al aula</h1><p>Conoce las opciones disponibles actualmente para empezar con YachayPlay.</p></div><div className="pa-plan-grid"><article className="pa-plan"><span className="pa-overline">PARA EMPEZAR</span><h2>Explora YachayPlay</h2><p>Regístrate, conoce los juegos educativos y descubre las herramientas disponibles.</p><ul><li>Cuenta para docente o estudiante</li><li>Catálogo de actividades</li><li>Ingreso a partidas mediante código</li></ul><button className="pa-primary" onClick={onRegister}>Crear cuenta</button></article><article className="pa-plan"><span className="pa-overline">INFORMACIÓN</span><h2>Planes adicionales</h2><p>Por ahora no hay precios ni planes de pago confirmados en esta página. Evitamos mostrar tarifas o beneficios no anunciados.</p><a className="pa-secondary" href="#/contacto">Ver contacto</a></article></div></section>}
        {page === "contacto" && <section className="pa-subpage"><div className="pa-pagehead"><span className="pa-overline">ESTAMOS AQUÍ</span><h1>¿Necesitas ayuda con YachayPlay?</h1><p>Consulta las preguntas frecuentes o accede a tu cuenta para comenzar.</p></div><div className="pa-feature-grid"><article><strong>¿Cómo puedo jugar?</strong><p>Tu docente te facilita un código de seis dígitos. Ingresa el código y elige un equipo.</p><button className="pa-primary" onClick={onJoinWithCode}>Unirme con código</button></article><article><strong>¿Cómo creo una actividad?</strong><p>Crea una cuenta como docente, elige un juego y prepara tu partida.</p><button className="pa-primary" onClick={onRegister}>Crear cuenta</button></article><article><strong>¿Dónde puedo consultar más?</strong><p>Revisa las características y la explicación del funcionamiento. No se ha configurado todavía un correo de soporte oficial.</p><a className="pa-secondary" href="#/como-funciona">Cómo funciona</a></article></div></section>}
      </main>
      <footer className="pa-footer" aria-label="Pie de página de YachayPlay">
        <div className="pa-footer-inner">
          <div className="pa-footer-main">
            <div className="pa-footer-brand">
              <a href="#/inicio" className="pa-footer-logo" aria-label="YachayPlay, ir al inicio">Yachay<span>Play</span><span className="pa-footer-spark" aria-hidden="true">✳</span></a>
              <p>Transformamos el aprendizaje en una experiencia divertida e interactiva.</p>
              <span className="pa-footer-motto">Aprende jugando, crece compartiendo.</span>
            </div>
            <nav className="pa-footer-links" aria-label="Explorar YachayPlay">
              <h2>Explorar</h2>
              <a href="#/inicio">Inicio</a>
              <a href="#/juegos">Juegos</a>
              <a href="#/caracteristicas">Características</a>
              <a href="#/como-funciona">Cómo funciona</a>
            </nav>
            <nav className="pa-footer-links" aria-label="Información y acceso">
              <h2>Información</h2>
              <a href="#/planes">Planes</a>
              <a href="#/contacto">Contacto</a>
              <button type="button" onClick={onLogin}>Iniciar sesión</button>
              <button type="button" onClick={onRegister}>Crear cuenta</button>
            </nav>
          </div>
          <div className="pa-footer-bottom">
            <span>© {new Date().getFullYear()} YachayPlay. Todos los derechos reservados.</span>
            <span className="pa-footer-bottom-right"><span>Aprende jugando ✦</span>{buildVersion && <span className="pa-footer-build">Build {buildVersion}</span>}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function GameCatalog(props) {
  return props.user ? <HomeLogged {...props} /> : <Landing {...props} />;
}
