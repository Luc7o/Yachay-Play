import { Marca } from "../campusUi";
import { Button } from "../ui";

// ============================================================================
// LUDO · CONECTANDO / ERROR AL ENTRAR — diseño "Campus". Props sin cambios.
// ============================================================================
export function LoadingScreen({ code, error, onReset }) {
  return (
    <div className="cp stu-page">
      <header className="stu-top">
        <Marca />
      </header>
      <main className="stu-main">
        <div className="stu-card" role={error ? "alert" : "status"}>
          {error ? (
            <>
              <span className="cp-eyebrow">Partida {code}</span>
              <h1>No se pudo entrar</h1>
              <p className="cp-msg error">{error}</p>
              <p className="stu-lead">
                La partida <b>{code}</b> ya no existe. Pide el código nuevo a tu docente y vuelve a entrar.
              </p>
              <Button size="lg" className="cp-full" onClick={onReset}>
                Volver a entrar
              </Button>
            </>
          ) : (
            <>
              <span className="cp-eyebrow">Partida {code}</span>
              <h1>Conectando…</h1>
              <p className="stu-lead">Sincronizando con la partida.</p>
              <span className="stu-loader" aria-hidden="true" />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
