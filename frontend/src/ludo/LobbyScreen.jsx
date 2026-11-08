import { useState } from "react";
import { Brand } from "../Brand";
import { COLORS, TURN_ORDER } from "../constants";
import { Step } from "./SetupScreen";

export function LobbyScreen({ gameName, gameCode, teams, activeTeams = TURN_ORDER, connectedByTeam, players = [], startGame, newGame, changeDevice }) {
  if (!activeTeams.length) activeTeams = TURN_ORDER;
  const [copied, setCopied] = useState(false);

  const totalSlots = activeTeams.reduce((n, t) => n + teams[t].slots, 0);
  const totalConnected = players.filter((p) => activeTeams.includes(p.team)).length;
  const pct = totalSlots ? Math.min(100, Math.round((totalConnected / totalSlots) * 100)) : 0;

  // Dirección a la que entran los estudiantes (con el código ya incluido)
  const joinUrl = `${window.location.origin}/?role=student&code=${gameCode}`;
  const esLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia este enlace:", joinUrl);
    }
  }

  return (
    <div className="app wait-page">
      <header className="ref-topbar">
        <Brand subtitle={<>Sala de espera • {gameName}</>} />
        <div className="ref-controls">
          <div className="time-box">
            <span>CÓDIGO</span>
            <b>{gameCode}</b>
          </div>
          <button className="ref-yellow" onClick={changeDevice}>
            Salir al inicio
          </button>
        </div>
      </header>

      <main className="wait-main">
        <section className="wait-left">
          <span className="hero-eyebrow">SALA DE ESPERA · LUDO EDUCATIVO</span>
          <h1 className="wait-title">{gameName}</h1>

          {/* Código para proyectar */}
          <div className="wait-code-panel">
            <span className="wait-code-label">CÓDIGO DE PARTIDA</span>
            <div className="wait-code-digits" aria-label={`Código ${gameCode}`}>
              {String(gameCode).split("").map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <p className="wait-code-how">
              Entra desde el celular a <b>{window.location.host}</b> y escribe este código.
            </p>
            {esLocal && (
              <p className="wait-code-warn">
                ⚠️ Estás en “localhost”: los celulares no podrán abrirlo. Abre esta página con la IP de tu computadora
                (por ejemplo, http://192.168.1.10:5173).
              </p>
            )}
            <button className="wait-copy" onClick={copiarEnlace}>
              {copied ? "✓ ¡Enlace copiado!" : "🔗 Copiar enlace directo"}
            </button>
          </div>

          {/* Avance de conexión */}
          <div className="wait-progress">
            <div className="wait-progress-top">
              <strong>
                {totalConnected} de {totalSlots} estudiantes conectados
              </strong>
              <span>{pct}%</span>
            </div>
            <div className="wait-bar">
              <i style={{ width: pct + "%" }} />
            </div>
          </div>

          {/* Equipos con los nombres de quienes ya entraron */}
          <div className="wait-teams">
            {activeTeams.map((t) => {
              const miembros = players.filter((p) => p.team === t);
              const completo = miembros.length >= teams[t].slots;
              return (
                <div
                  className={"wait-team" + (completo ? " full" : "")}
                  key={t}
                  style={{ "--tc": COLORS[t].hex, "--ts": COLORS[t].soft }}
                >
                  <div className="wait-team-head">
                    <i className="cfg-team-dot" />
                    <strong>{COLORS[t].name}</strong>
                    <span className="wait-team-count">
                      {connectedByTeam[t] || 0} / {teams[t].slots}
                    </span>
                  </div>
                  <div className="wait-members">
                    {miembros.map((p) => (
                      <span className="wait-member" key={p.id}>
                        {p.name}
                      </span>
                    ))}
                    {Array.from({ length: Math.max(0, teams[t].slots - miembros.length) }, (_, i) => (
                      <span className="wait-member empty" key={"e" + i}>
                        esperando…
                      </span>
                    ))}
                  </div>
                  {completo && <small className="wait-full-tag">✓ Equipo completo</small>}
                </div>
              );
            })}
          </div>

          {totalConnected === 0 && (
            <p className="wait-empty-note">Aún no hay estudiantes conectados. Puedes iniciar cuando quieras, pero conviene esperar.</p>
          )}

          <div className="wait-actions">
            <button className="wait-start" onClick={startGame}>
              Iniciar partida ▶
            </button>
            <button className="wait-new" onClick={newGame}>
              ➕ Crear partida nueva
            </button>
          </div>
        </section>

        <aside className="wait-side">
          <div className="cfg-guide">
            <img src="/mascota-explica.png" alt="" />
            <p>Cuando tus estudiantes estén listos, pulsa “Iniciar partida”.</p>
          </div>

          <div className="cfg-how">
            <h3>Cómo se unen los estudiantes</h3>
            <Step n="1" t="Abren la dirección" d="Desde el navegador de su celular, en la misma red Wi-Fi." />
            <Step n="2" t="Escriben el código" d="Son 6 números; los ven en esta pantalla." />
            <Step n="3" t="Eligen su equipo" d="Y esperan a que empiece el juego." />
          </div>

          <div className="wait-phone">
            <span className="eyebrow">ASÍ LO VERÁN EN EL CELULAR</span>
            <div className="phone-preview">
              <div className="phone-screen">
                <div className="phone-brand"><img className="phone-logo" src="/logo.png" alt="YachayPlay" /></div>
                <div className="phone-code-label">Código</div>
                <div className="phone-code">{gameCode}</div>
                <div className="phone-mini-field">Nombre del alumno</div>
                <div className="phone-mini-field">Elegir equipo</div>
                <div className="phone-mini-button">UNIRME A LA PARTIDA</div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
