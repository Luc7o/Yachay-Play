import { useState } from "react";
import { Marca, BotonTema } from "../campusUi";
import { Button } from "../ui";

// ============================================================================
// CRUCIGRAMA · UNIRSE (estudiante) — diseño "Campus", como el ingreso de Ludo.
// Props sin cambios.
// ============================================================================
export function CwStudentJoin({ goHome, prefillName, onJoin, error, initialCode = "" }) {
  const [codeInput, setCodeInput] = useState(initialCode);
  const [name, setName] = useState(prefillName);
  const listo = codeInput.trim().length === 6 && name.trim().length > 0;

  return (
    <div className="cp stu-page">
      <header className="stu-top">
        <Marca onClick={goHome} label="Volver al inicio de YachayPlay" />
        <div className="stu-top-right">
          <BotonTema />
        </div>
      </header>
      <main className="stu-main">
        <form
          className="stu-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (listo) onJoin(codeInput, name);
          }}
        >
          <div>
            <span className="cp-eyebrow">Crucigrama relámpago</span>
            <h1>Únete al reto</h1>
            <p className="stu-lead">Escribe el código de tu docente y prepárate para competir.</p>
          </div>
          <div className="cp-field">
            <label htmlFor="cw-code">Código</label>
            <input
              id="cw-code"
              className="cp-input stu-code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
            />
          </div>
          <div className="cp-field">
            <label htmlFor="cw-name">Tu nombre</label>
            <input
              id="cw-name"
              className="cp-input"
              value={name}
              maxLength={30}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Andrea"
            />
          </div>
          {error && (
            <p className="cp-msg error" role="alert">
              {error}
            </p>
          )}
          <Button size="lg" className="cp-full" type="submit" disabled={!listo}>
            Entrar a competir
          </Button>
          <Button variant="quiet" onClick={goHome}>
            ← Volver al inicio
          </Button>
        </form>
      </main>
    </div>
  );
}
