import { useEffect, useState } from "react";
import { Step, Options } from "./Common";

// ============================================================================
// CRUCIGRAMA · CREAR PARTIDA (docente) — diseño "Campus". Va dentro del menú de la app.
// Props sin cambios: goHome, onCreate(name, minutes, wordCount), error.
// ============================================================================
export function CwTeacherSetup({ goHome, onCreate, error }) {
  const [name, setName] = useState("Reto de Inventos");
  const [minutes, setMinutes] = useState(8);
  const [wordCount, setWordCount] = useState(12);
  const [creating, setCreating] = useState(false);
  // Si algo salió mal (código repetido, backend caído, respuesta demasiado
  // tardía...) el botón vuelve a activarse para poder reintentar.
  useEffect(() => {
    if (error) setCreating(false);
  }, [error]);

  function crear() {
    setCreating(true);
    onCreate(name, minutes, wordCount);
  }

  return (
    <div className="cp cp-home cfg2">
      <div className="cp-pagehead">
        <div>
          <span className="cp-eyebrow">Crucigrama relámpago</span>
          <h1>Crear un crucigrama en vivo</h1>
          <p>Todos tus estudiantes reciben el mismo crucigrama y compiten por terminarlo.</p>
        </div>
        <button type="button" className="cp-btn ghost" onClick={goHome}>Cancelar</button>
      </div>

      <div className="cfg2-grid">
        <div className="cfg2-form">
          <section className="cp-card cp-panel" aria-labelledby="cw2-p1">
            <div className="cfg2-step"><span>1</span><h2 id="cw2-p1">Nombre de la partida</h2></div>
            <p>Así la verán tus estudiantes al entrar.</p>
            <label htmlFor="cw2-nombre" className="cp-sr">Nombre de la partida</label>
            <input id="cw2-nombre" className="cp-input" value={name} maxLength={60} placeholder="Ej. Reto de Inventos" onChange={(e) => setName(e.target.value)} />
          </section>

          <section className="cp-card cp-panel" aria-labelledby="cw2-p2">
            <div className="cfg2-step"><span>2</span><h2 id="cw2-p2">Cuántas palabras</h2></div>
            <p>Más palabras: partida más larga y más cruces en el tablero.</p>
            <Options label="Cantidad de palabras" value={wordCount} options={[6, 8, 10, 12, 15, 20]} onChange={setWordCount} format={(n) => `${n} palabras`} />
          </section>

          <section className="cp-card cp-panel" aria-labelledby="cw2-p3">
            <div className="cfg2-step"><span>3</span><h2 id="cw2-p3">Duración</h2></div>
            <p>Cuando se acabe el tiempo, la partida termina para todos.</p>
            <Options label="Duración" value={minutes} options={[3, 5, 8, 10, 15, 20]} onChange={setMinutes} format={(n) => `${n} min`} />
          </section>
        </div>

        <aside className="cfg2-side" aria-label="Resumen de la partida">
          <div className="cp-card cp-panel cfg2-summary">
            <span className="cp-eyebrow">Resumen</span>
            <h2>{name.trim() || "Sin nombre todavía"}</h2>
            <dl className="cfg2-dl">
              <div><dt>Palabras</dt><dd>{wordCount}</dd></div>
              <div><dt>Duración</dt><dd>{minutes} min</dd></div>
              <div><dt>Sabotajes</dt><dd>Congelar · Niebla · Robar</dd></div>
            </dl>
            {!name.trim() && <p className="cp-help">Escribe un nombre para la partida.</p>}
            {error && <p className="cp-msg error" role="alert">{error}</p>}
            <button type="button" className="cp-btn primary lg cp-full" disabled={creating || !name.trim()} onClick={crear}>
              {creating ? "Creando…" : "Crear crucigrama"}
            </button>
            <p className="cp-help">Se generará un código de 6 dígitos para que tus estudiantes entren desde el celular.</p>
          </div>

          <div className="cp-card cp-panel cfg2-how">
            <h3>Así funciona</h3>
            <Step n="1" t="Compartes el código" d="Tus estudiantes entran desde su celular." />
            <Step n="2" t="Cada quien responde a su ritmo" d="Mismo crucigrama para todos, tableros separados." />
            <Step n="3" t="Ganan energía por racha" d="Y la usan para sabotear a un rival: congelar, niebla o robar puntos." />
          </div>
        </aside>
      </div>
    </div>
  );
}
