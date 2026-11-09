import { useEffect, useState } from "react";
import { Brand } from "../Brand";
import { Step, Options } from "./Common";

// ============================================================================
// DOCENTE: crear la partida
// ============================================================================
export function CwTeacherSetup({ goHome, onCreate, error }) {
  const [name, setName] = useState("Reto de Inventos");
  const [minutes, setMinutes] = useState(8);
  const [wordCount, setWordCount] = useState(12);
  const [creating, setCreating] = useState(false);
  // Si algo salió mal (código repetido, backend caído, respuesta demasiado
  // tardía...) el botón debe volver a activarse para poder reintentar, en
  // vez de quedarse diciendo "Creando…" para siempre.
  useEffect(() => {
    if (error) setCreating(false);
  }, [error]);

  function crear() {
    setCreating(true);
    onCreate(name, minutes, wordCount);
  }

  return (
    <div className="app cfg-page">
      <header className="ref-topbar">
        <Brand subtitle="Crucigrama Relámpago · Configuración" onClick={goHome} />
      </header>
      <main className="cfg-main">
        <div className="cfg-form">
          <button className="back-link" onClick={goHome}>← Volver al inicio</button>
          <span className="hero-eyebrow">PANEL DEL DOCENTE · CRUCIGRAMA RELÁMPAGO</span>
          <h1 className="cfg-title">Crear un crucigrama en vivo</h1>
          <p className="cfg-lead">Todos tus estudiantes recibirán el mismo crucigrama y competirán por terminarlo.</p>

          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">1</span>
              <div><h2>Nombre de la partida</h2><p>Así la verán tus estudiantes al entrar.</p></div>
            </div>
            <input className="cfg-input" value={name} maxLength={60} placeholder="Ej. Reto de Inventos" onChange={(e) => setName(e.target.value)} />
          </section>

          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">2</span>
              <div><h2>Cuántas palabras</h2><p>Más palabras = partida más larga y más cruces en el tablero.</p></div>
            </div>
            <Options value={wordCount} options={[6, 8, 10, 12, 15, 20]} onChange={setWordCount} format={(n) => `${n} palabras`} />
          </section>

          <section className="cfg-card">
            <div className="cfg-card-head">
              <span className="cfg-num">3</span>
              <div><h2>Duración</h2><p>Cuando se acabe el tiempo, la partida termina para todos.</p></div>
            </div>
            <Options value={minutes} options={[3, 5, 8, 10, 15, 20]} onChange={setMinutes} format={(n) => `${n} min`} />
          </section>
        </div>

        <aside className="cfg-side">
          <div className="cfg-guide">
            <img src="/mascota-explica.png" alt="" />
            <p>¡Ya casi! Revisa el resumen y crea tu crucigrama.</p>
          </div>

          <div className="cfg-summary">
            <span className="preview-badge">RESUMEN</span>
            <h2>{name.trim() || "Sin nombre todavía"}</h2>
            <dl className="cfg-sum-list">
              <div><dt>Palabras</dt><dd>{wordCount}</dd></div>
              <div><dt>Duración</dt><dd>{minutes} min</dd></div>
              <div><dt>Sabotajes</dt><dd>🧊 🌫️ 💰</dd></div>
            </dl>
            {!name.trim() && <p className="join-error">Escribe un nombre para la partida.</p>}
            {error && <p className="join-error">{error}</p>}
            <button className="cfg-create" disabled={creating || !name.trim()} onClick={crear}>
              {creating ? "Creando…" : "Crear crucigrama ⚡"}
            </button>
            <p className="cfg-note">Se generará un código de 6 dígitos para que tus estudiantes se unan desde el celular.</p>
          </div>

          <div className="cfg-how">
            <h3>Así funcionará</h3>
            <Step n="1" t="Compartes el código" d="Tus estudiantes entran desde su celular con este código." />
            <Step n="2" t="Cada quien responde a su ritmo" d="Mismo crucigrama para todos, tableros separados." />
            <Step n="3" t="Ganan energía por racha" d="Y la usan para sabotear a un rival: congelar, niebla o robar puntos." />
          </div>
        </aside>
      </main>
    </div>
  );
}
