import { useState } from "react";
import { Brand } from "../Brand";

// ============================================================================
// ESTUDIANTE: unirse con el código
// ============================================================================
export function CwStudentJoin({ goHome, prefillName, onJoin, error, initialCode = "" }) {
  const [codeInput, setCodeInput] = useState(initialCode);
  const [name, setName] = useState(prefillName);
  const listo = codeInput.trim().length === 6 && name.trim().length > 0;

  return (
    <div className="app join-page">
      <header className="ref-topbar"><Brand subtitle="Crucigrama Relámpago" onClick={goHome} /></header>
      <main className="join-main">
        <aside className="join-guide">
          <img src="/mascota-explica.png" alt="" />
          <p>¡Escribe el código de tu docente y prepárate para competir!</p>
        </aside>
        <section className="join-card">
          <span className="hero-eyebrow">CRUCIGRAMA RELÁMPAGO</span>
          <h1>Unirme al reto</h1>
          <label className="join-label" htmlFor="cw-code"><span className="cfg-num">1</span> Código de partida</label>
          <input
            id="cw-code"
            className="join-code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
          />
          <label className="join-label" htmlFor="cw-name"><span className="cfg-num">2</span> Tu nombre</label>
          <input id="cw-name" className="join-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Ej. Andrea" />
          {error && <p className="join-error">{error}</p>}
          <button className="join-btn" disabled={!listo} onClick={() => onJoin(codeInput, name)}>
            ¡Entrar a competir! ⚡
          </button>
          <button className="back-link" onClick={goHome}>← Volver al inicio</button>
        </section>
      </main>
    </div>
  );
}
