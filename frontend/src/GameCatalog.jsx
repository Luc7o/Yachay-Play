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

// ---- Diseño "Aula Fresca": textos y símbolos de las tarjetas del inicio ----
const CATALOGO = [
  { id: "ludo", glyph: "⚄", name: "Ludo Educativo", desc: "Tablero por equipos: preguntas, dados y llegar a la meta.", ok: true },
  { id: "crucigrama", glyph: "▦", name: "Crucigrama Relámpago", desc: "Resuelve el crucigrama contra el reloj y compite con tus rivales.", ok: true },
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
            <img className="dh-mascot" src="/yachayplay-mascota.png" alt="Mascota dragón de YachayPlay" />
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
