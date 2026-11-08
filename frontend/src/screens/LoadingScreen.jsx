export function LoadingScreen({ code, error, onReset }) {
  if (error) {
    return (
      <div className="app student-lobby">
        <main className="student-page">
          <div className="phone-card">
            <span className="eyebrow">YACHAYPLAY</span>
            <div className="join-success error">!</div>
            <h1>No se pudo entrar</h1>
            <p className="join-error">{error}</p>
            <p className="muted">
              La partida <b>{code}</b> ya no existe. Pide el código nuevo al docente y vuelve a ingresar.
            </p>
            <button className="create-ref" onClick={onReset}>
              Volver a ingresar
            </button>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="app student-lobby">
      <main className="student-page">
        <div className="phone-card">
          <span className="eyebrow">YACHAYPLAY</span>
          <h1>Conectando…</h1>
          <p className="muted">Sincronizando con la partida {code}.</p>
        </div>
      </main>
    </div>
  );
}
