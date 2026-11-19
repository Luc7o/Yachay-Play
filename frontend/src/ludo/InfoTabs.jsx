import { COLORS, TURN_ORDER } from "../constants";

export function QuestionsTab({ bank }) {
  return (
    <main className="proj-main eg-info">
      <div className="cp-card cp-panel">
        <h2>Banco de preguntas de esta partida</h2>
        <p className="cp-help">Preguntas de opción múltiple: las oficiales más las tuyas.</p>
        <div className="question-table">
          {bank.map((q) => (
            <div className="q-row" key={q.id}>
              <b>{q.id}</b>
              <span>
                <strong>{q.topic}</strong>
                <small>{q.level}</small>
              </span>
              <p>{q.question}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function ScoresTab({ teams, history }) {
  return (
    <main className="proj-main eg-info">
      <div className="eg-score-grid">
        {TURN_ORDER.map((t) => (
          <div className="cp-card eg-score-card" key={t} style={{ "--tc": COLORS[t].hex }}>
            <span>{COLORS[t].name}</span>
            <strong>{teams[t].score} / 20</strong>
            <small>
              {teams[t].correct} correctas • {teams[t].incorrect} incorrectas
            </small>
          </div>
        ))}
      </div>
      <div className="cp-card cp-panel">
        <h2>Historial de turnos</h2>
        {history.length === 0 ? (
          <p className="cp-help">Aún no hay registros.</p>
        ) : (
          history.map((h) => (
            <div className="history-row" key={`${h.turn}-${h.team}`}>
              <span>Turno {h.turn}</span>
              <b style={{ color: COLORS[h.team].hex }}>{COLORS[h.team].name}</b>
              <span>Dado: {h.dice}</span>
              <span>{h.topic}</span>
              <b className={h.correct ? "eg-ok" : "eg-bad"}>{h.correct ? "Correcta" : "Incorrecta"}</b>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

export function RulesTab() {
  return (
    <main className="proj-main eg-info">
      <div className="eg-rules">
        <div className="cp-card cp-panel">
          <h2>Flujo propuesto</h2>
          <ol>
            <li>Crear y configurar la partida.</li>
            <li>Compartir el código con los alumnos.</li>
            <li>El equipo en turno lanza el dado desde el celular.</li>
            <li>Mostrar la pregunta.</li>
            <li>El equipo en turno responde desde sus celulares.</li>
            <li>Aplicar el movimiento y continuar.</li>
          </ol>
        </div>
        <div className="cp-card cp-panel">
          <h2>Reglas del tablero</h2>
          <p><b>Acierta → avanza.</b> La ficha avanza exactamente el número que marcó el dado.</p>
          <p><b>Falla o se le acaba el tiempo → no se mueve.</b></p>
          <p>Cada ficha recorre 57 pasos: 51 casillas del anillo + 5 de su recta final + la meta.</p>
          <p>Con la primera respuesta correcta la ficha sale de casa a su casilla de salida.</p>
          <p>Para entrar a la meta hace falta el número exacto; si se pasa, se queda donde está.</p>
          <p>Si cae justo sobre una ficha rival la come y esa ficha vuelve a casa, salvo en las casillas seguras (★).</p>
          <p>Gana el primer equipo que lleve una ficha a la meta; si se acaba el tiempo, gana el de más puntos.</p>
        </div>
      </div>
    </main>
  );
}

// ==================== Pantallas del estudiante ====================
