import React from "react";
import { Brand } from "./Brand";
import { CwGridIcon } from "./Crossword";

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
  { id: "ludo", name: "Ludo Educativo", available: true, icon: "ludo", bg: "linear-gradient(145deg,#0A4C8F,#023A73)" },
  { id: "crucigrama", name: "Crucigrama Relámpago", available: true, icon: "crucigrama", bg: "linear-gradient(145deg,#023A73,#0A4C8F)" },
  { id: "quiz", name: "Quiz", available: false, icon: "❓", bg: "linear-gradient(145deg,#F16503,#D45500)" },
  { id: "sino", name: "Sí o No", available: false, icon: "✅", bg: "linear-gradient(145deg,#0A4C8F,#2B6AA8)" },
  { id: "adivinanza", name: "Adivinanza", available: false, icon: "🔮", bg: "linear-gradient(145deg,#F16503,#ff9a4d)" },
  { id: "relacionar", name: "Relacionar grupos", available: false, icon: "🧩", bg: "linear-gradient(145deg,#023A73,#2B6AA8)" },
  { id: "sopa", name: "Sopa de letras", available: false, icon: "🔤", bg: "linear-gradient(145deg,#D45500,#F16503)" },
  { id: "memoria", name: "Memoria", available: false, icon: "🧠", bg: "linear-gradient(145deg,#2B6AA8,#0A4C8F)" },
  { id: "ordenar", name: "Ordenar frases", available: false, icon: "🔢", bg: "linear-gradient(145deg,#F16503,#D45500)" },
];

// Herramientas para el docente. Cada una es un componente de React (Cronometro.jsx,
// Ruleta.jsx, Pizarra.jsx) que App.jsx muestra al elegirla, igual que Ludo y el Crucigrama.
// Para agregar otra: crea su componente, añádelo aquí y agrega su pantalla en App.jsx.
export const TOOLS = [
  { id: "cronometro", name: "Cronómetro de actividad", icon: "⏱️", bg: "linear-gradient(145deg,#F16503,#D45500)" },
  { id: "ruleta", name: "Ruleta de sorteos", icon: "🎡", bg: "linear-gradient(145deg,#0A4C8F,#023A73)" },
  { id: "pizarra", name: "Pizarra", icon: "🖍️", bg: "linear-gradient(145deg,#2B6AA8,#0A4C8F)" },
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

export function GameCatalog({ onSelectGame, onJoinWithCode, buildVersion, user, onLogin, onRegister, onLogout, onOpenStats, onOpenQuestions, onOpenProfile }) {
  const primerNombre = user ? user.name.split(" ")[0] : "";
  const esDocente = user?.role === "docente";
  return (
    <div className="app catalog-page">
      <header className="ref-topbar">
        <Brand />
        <nav className="catalog-nav">
          <span className="catalog-nav-item active">▦ Tipos de juegos</span>
          {user ? (
            <>
              <button className="catalog-tool" onClick={onOpenStats}>📊 {esDocente ? "Estadísticas" : "Mis resultados"}</button>
              {esDocente && <button className="catalog-tool" onClick={onOpenQuestions}>📚 Mis preguntas</button>}
              <button className="user-chip user-chip-btn" title="Ver mi perfil" onClick={onOpenProfile}>
                <i>{user.name.trim().charAt(0).toUpperCase()}</i>
                <span>
                  <b>{primerNombre}</b>
                  <small>{esDocente ? "Docente" : "Estudiante"}</small>
                </span>
              </button>
              <button className="catalog-logout" onClick={onLogout}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <button className="catalog-login" onClick={onLogin}>Iniciar sesión</button>
              <button className="ref-yellow catalog-join" onClick={onRegister}>Crear cuenta</button>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            {user ? (
              <span className="hero-eyebrow hero-hello">¡HOLA, {primerNombre.toUpperCase()}! 👋</span>
            ) : (
              <span className="hero-eyebrow">{HERO.eyebrow}</span>
            )}
            <h1 className="hero-title">{HERO.title}</h1>
            <p className="hero-lead">{HERO.text}</p>
            <p className="hero-quechua">{HERO.quechua}</p>
            <div className="hero-actions">
              <a className="hero-btn hero-btn-main" href="#juegos">Ver los juegos</a>
              {user ? (
                <button className="hero-btn hero-btn-alt" onClick={() => (esDocente ? onSelectGame("ludo") : onJoinWithCode())}>
                  {esDocente ? "🖥️ Crear una partida" : "📱 Unirme con código"}
                </button>
              ) : (
                <button className="hero-btn hero-btn-alt" onClick={onJoinWithCode}>📱 Unirme con código</button>
              )}
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

      <main className="catalog-main" id="juegos">
        <h2 className="catalog-title">▦ Tipos de juegos</h2>
        <p className="catalog-sub">Elige un juego para crear una partida con tus estudiantes.</p>

        <div className="catalog-grid">
          {GAMES.map((g) => (
            <button
              key={g.id}
              className={"game-tile" + (g.available ? "" : " soon")}
              onClick={() => g.available && onSelectGame(g.id)}
              disabled={!g.available}
              title={g.available ? g.name : "Próximamente"}
            >
              <span className="game-icon" style={{ background: g.bg }}>
                {g.icon === "ludo" ? <LudoIcon /> : g.icon === "crucigrama" ? <CwGridIcon /> : <span className="game-emoji">{g.icon}</span>}
                {!g.available && <span className="soon-badge">Próximamente</span>}
              </span>
              <span className="game-label">{g.name}</span>
            </button>
          ))}
        </div>

        {/* Herramientas para dar la clase en vivo (no se muestran a estudiantes) */}
        {!(user && user.role === "estudiante") && (
          <section aria-labelledby="tools-title">
            <h2 className="catalog-title" id="tools-title" style={{ marginTop: 56 }}>🧰 Herramientas para docentes</h2>
            <p className="catalog-sub">Para dar tu clase en vivo y proyectar la pantalla. No necesitan cuenta.</p>
            <div className="catalog-grid-tools">
              {TOOLS.map((t) => (
                <button key={t.id} className="game-tile" onClick={() => onSelectGame(t.id)} title={t.name}>
                  <span className="game-icon" style={{ background: t.bg }}>
                    <span className="game-emoji">{t.icon}</span>
                  </span>
                  <span className="game-label">{t.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="build-mark">YachayPlay · Build {buildVersion}</footer>
    </div>
  );
}
