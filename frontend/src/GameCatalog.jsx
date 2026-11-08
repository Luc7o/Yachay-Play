import React from "react";
import { Brand } from "./Brand";
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
  { id: "quiz", name: "Quiz", desc: "Preguntas de opción múltiple para toda la clase.", available: false, icon: "❓", bg: "linear-gradient(145deg,#F16503,#D45500)" },
  { id: "sino", name: "Sí o No", desc: "Afirmaciones que se responden con verdadero o falso.", available: false, icon: "✅", bg: "linear-gradient(145deg,#0A4C8F,#2B6AA8)" },
  { id: "adivinanza", name: "Adivinanza", desc: "Pistas que los estudiantes deben descifrar.", available: false, icon: "🔮", bg: "linear-gradient(145deg,#F16503,#ff9a4d)" },
  { id: "relacionar", name: "Relacionar grupos", desc: "Une cada concepto con su categoría o definición.", available: false, icon: "🧩", bg: "linear-gradient(145deg,#023A73,#2B6AA8)" },
  { id: "sopa", name: "Sopa de letras", desc: "Encuentra las palabras escondidas en la cuadrícula.", available: false, icon: "🔤", bg: "linear-gradient(145deg,#D45500,#F16503)" },
  { id: "memoria", name: "Memoria", desc: "Encuentra las parejas de cartas iguales.", available: false, icon: "🧠", bg: "linear-gradient(145deg,#2B6AA8,#0A4C8F)" },
  { id: "ordenar", name: "Ordenar frases", desc: "Ordena las palabras para formar la frase correcta.", available: false, icon: "🔢", bg: "linear-gradient(145deg,#F16503,#D45500)" },
];

// Herramientas para el docente. Cada una es un componente de React (Cronometro.jsx,
// Ruleta.jsx, Pizarra.jsx) que App.jsx muestra al elegirla, igual que Ludo y el Crucigrama.
// Para agregar otra: crea su componente, añádelo aquí y agrega su pantalla en App.jsx.
export const TOOLS = [
  { id: "cronometro", name: "Cronómetro de actividad", desc: "Controla el tiempo de una actividad y proyéctalo en pantalla.", icon: "⏱️", bg: "linear-gradient(145deg,#F16503,#D45500)" },
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
      <rect x="42" y="42" width="16" height="16" rx="4" fill="#F16503" stroke="#fff" strokeWidth="3" />
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

// Inicio con sesión iniciada: menú lateral + saludo + tarjetas
function HomeLogged({ onSelectGame, onJoinWithCode, buildVersion, user, onLogout, onOpenStats, onOpenQuestions, onOpenProfile }) {
  const esDocente = user.role === "docente";
  const primerNombre = user.name.split(" ")[0];

  const irA = (id) => {
    if (id === "stats") return onOpenStats();
    if (id === "questions") return onOpenQuestions();
    if (id === "profile") return onOpenProfile();
    if (id === "join") return onJoinWithCode();
    const el = id === "home" ? null : document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppShell user={user} active="home" onNavigate={irA} onLogout={onLogout} buildVersion={buildVersion}>
      <section className="dash-hero">
        <div>
          <span className="dash-hello">¡Hola, {primerNombre}! 👋</span>
          <h1>{esDocente ? "¿Qué quieres que aprendan hoy?" : "¿Listo para jugar?"}</h1>
          <p>
            {esDocente
              ? "Crea una partida, proyecta el código y deja que tus estudiantes se unan desde el celular."
              : "Ingresa el código que muestra tu docente y compite con tu equipo."}
          </p>
          <div className="dash-chips">
            {esDocente ? (
              <>
                <button className="dash-chip primary" onClick={() => onSelectGame("ludo")}>🖥️ Crear partida de Ludo</button>
                <button className="dash-chip" onClick={() => onSelectGame("crucigrama")}>⚡ Crear crucigrama</button>
                <button className="dash-chip" onClick={onOpenQuestions}>📚 Mis preguntas</button>
                <button className="dash-chip" onClick={onOpenStats}>📊 Estadísticas</button>
              </>
            ) : (
              <>
                <button className="dash-chip primary" onClick={onJoinWithCode}>📱 Unirme con código</button>
                <button className="dash-chip" onClick={onOpenStats}>📊 Mis resultados</button>
              </>
            )}
          </div>
        </div>
        <img className="dash-img" src="/yachayplay-mascota.png" alt="" />
      </section>

      <GamesSection onSelectGame={onSelectGame} esEstudiante={!esDocente} showTools={esDocente} />
    </AppShell>
  );
}

// Portada para visitantes (sin sesión)
function Landing({ onSelectGame, onJoinWithCode, buildVersion, onLogin, onRegister }) {
  return (
    <div className="app catalog-page">
      <header className="ref-topbar">
        <Brand />
        <nav className="catalog-nav">
          <span className="catalog-nav-item active">▦ Tipos de juegos</span>
          <button className="catalog-login" onClick={onLogin}>Iniciar sesión</button>
          <button className="ref-yellow catalog-join" onClick={onRegister}>Crear cuenta</button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-eyebrow">{HERO.eyebrow}</span>
            <h1 className="hero-title">{HERO.title}</h1>
            <p className="hero-lead">{HERO.text}</p>
            <p className="hero-quechua">{HERO.quechua}</p>
            <div className="hero-actions">
              <a className="hero-btn hero-btn-main" href="#juegos">Ver los juegos</a>
              <button className="hero-btn hero-btn-alt" onClick={onJoinWithCode}>📱 Unirme con código</button>
            </div>
          </div>
          <img className="hero-img" src="/yachayplay-mascota.png" alt="Mascota de YachayPlay: un dragón andino con chullo, una tableta de preguntas y un trofeo" />
        </div>
        <div className="hero-values">
          {HERO.values.map((v) => (
            <div className="hero-value" key={v.title}>
              <span className="hero-value-icon">{v.icon}</span>
              <div>
                <strong>{v.title}</strong>
                <p>{v.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <main className="gc-wrap">
        <GamesSection onSelectGame={onSelectGame} esEstudiante={false} showTools />
      </main>

      <footer className="build-mark">YachayPlay · Build {buildVersion}</footer>
    </div>
  );
}

export function GameCatalog(props) {
  return props.user ? <HomeLogged {...props} /> : <Landing {...props} />;
}
