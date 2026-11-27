import { useState } from "react";
import { Brand } from "../Brand";
import { COLORS, TURN_ORDER } from "../constants";
import { Step } from "./SetupScreen";
import { Button } from "../ui";
import type { Equipo } from "../constants";

// ============================================================================
// LUDO · SALA DE ESPERA (docente, para proyectar) — diseño "Campus", modo proyección
// (oscuro siempre: .cp-proj en campusJuegos.css). Props sin cambios.
// ============================================================================
export function LobbyScreen({
  gameName,
  gameCode,
  teams,
  activeTeams = TURN_ORDER,
  connectedByTeam,
  players = [] as { id: string; name: string; team: Equipo }[],
  startGame,
  newGame,
  changeDevice,
}) {
  if (!activeTeams.length) activeTeams = TURN_ORDER;
  const [copied, setCopied] = useState(false);

  const totalSlots = activeTeams.reduce((n, t) => n + teams[t].slots, 0);
  const totalConnected = players.filter((p) => activeTeams.includes(p.team)).length;
  const pct = totalSlots ? Math.min(100, Math.round((totalConnected / totalSlots) * 100)) : 0;

  // Dirección a la que entran los estudiantes (con el código ya incluido)
  const joinUrl = `${window.location.origin}/?role=student&code=${gameCode}`;
  const esLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const codigo = String(gameCode);
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
    <div className="cp cp-proj">
      <header className="proj-top">
        <Brand />
        <div className="proj-top-info">
          <span className="cp-eyebrow">Ludo por equipos · sala de espera</span>
          <strong>{gameName}</strong>
        </div>
        <Button variant="ghost" onClick={changeDevice}>
          Salir al inicio
        </Button>
      </header>

      <main className="proj-main">
        <section className="proj-stage" aria-labelledby="proj-t">
          <div className="cp-card proj-hero">
            <div className="proj-hero-copy">
              <span className="cp-live">Sala abierta</span>
              <h1 id="proj-t">
                Entren en <b>{window.location.host}</b> con este código
              </h1>
              <p>Desde el celular o la laptop. La partida empieza cuando la inicies.</p>
              {esLocal && (
                <p className="proj-warn">
                  Estás en «localhost»: los celulares no podrán abrirlo. Abre esta página con la IP de tu computadora
                  (por ejemplo, http://192.168.1.10:5173).
                </p>
              )}
              <div>
                <Button variant="ghost" onClick={copiarEnlace}>
                  {copied ? "Enlace copiado" : "Copiar enlace directo"}
                </Button>
              </div>
            </div>
            <div className="proj-code" aria-label={`Código ${codigo.split("").join(" ")}`}>
              <span>Código</span>
              <strong>{codigo.length === 6 ? `${codigo.slice(0, 3)} ${codigo.slice(3)}` : codigo}</strong>
            </div>
          </div>

          <div className="cp-card cp-panel">
            <div className="proj-progress-top">
              <h2>En la sala</h2>
              <span>
                {totalConnected} de {totalSlots} estudiantes · {pct}%
              </span>
            </div>
            <div
              className="proj-bar"
              role="progressbar"
              aria-label="Estudiantes conectados"
              aria-valuemin={0}
              aria-valuemax={totalSlots}
              aria-valuenow={totalConnected}
            >
              <i style={{ width: pct + "%" }} />
            </div>
            <div className="proj-teams">
              {activeTeams.map((t) => {
                const miembros = players.filter((p) => p.team === t);
                const completo = miembros.length >= teams[t].slots;
                return (
                  <div className={"proj-team" + (completo ? " full" : "")} key={t} style={{ "--tc": COLORS[t].hex }}>
                    <div className="proj-team-head">
                      <i aria-hidden="true" />
                      <strong>{COLORS[t].name}</strong>
                      <span>
                        {connectedByTeam[t] || 0} / {teams[t].slots}
                        {completo ? " · completo" : ""}
                      </span>
                    </div>
                    <div className="proj-members">
                      {miembros.map((p) => (
                        <span className="proj-member" key={p.id}>
                          {p.name}
                        </span>
                      ))}
                      {Array.from({ length: Math.max(0, teams[t].slots - miembros.length) }, (_, i) => (
                        <span className="proj-member empty" key={"e" + i}>
                          esperando…
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {totalConnected === 0 && (
              <p className="cp-help">
                Aún no hay estudiantes conectados. Puedes iniciar cuando quieras, pero conviene esperar.
              </p>
            )}
          </div>

          <div className="proj-actions">
            <Button size="lg" onClick={startGame}>
              Iniciar partida
            </Button>
            <Button variant="ghost" size="lg" onClick={newGame}>
              Crear partida nueva
            </Button>
          </div>
        </section>

        <aside className="proj-side" aria-label="Cómo se unen los estudiantes">
          <div className="cp-card cp-panel">
            <h2>Cómo se unen</h2>
            <Step n="1" t="Abren la dirección" d="Desde el navegador de su celular." />
            <Step n="2" t="Escriben el código" d="Son 6 números; los ven en esta pantalla." />
            <Step n="3" t="Eligen su equipo" d="Y esperan a que empiece el juego." />
          </div>
          <div className="cp-card cp-panel">
            <h2>Enlace directo</h2>
            <p>Si lo compartes por el chat de la clase, el código ya va incluido.</p>
            <code className="proj-url">{joinUrl}</code>
          </div>
        </aside>
      </main>
    </div>
  );
}
