import React from "react";
import { cronometro, useCronometro, formatoTiempo } from "./cronometroStore";
import "./cronometroMini.css";

// ============================================================================
// VENTANITA DEL CRONÓMETRO (como el minirreproductor de YouTube)
// ============================================================================
// Aparece en cualquier pantalla cuando el cronómetro está en marcha (o ya
// terminó) y el docente salió de su pantalla. Al tocarla se vuelve al
// cronómetro completo. Los umbrales de color son los mismos que en
// Cronometro.jsx (30 % amarillo, 10 % rojo).
// ============================================================================
export const EVENTO_ABRIR = "yachay-abrir-herramienta";

export function CronometroMini() {
  const c = useCronometro();
  if (c.estado === "idle" || c.abierto || c.oculto) return null;

  const prop = c.total > 0 ? Math.max(0, Math.min(1, c.restante / c.total)) : 0;
  let visual = "normal";
  if (c.estado === "done") visual = "fin";
  else if (prop <= 0.1) visual = "urgente";
  else if (prop <= 0.3) visual = "aviso";

  const abrir = () => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR, { detail: "cronometro" }));
  const estadoTxt = c.estado === "done" ? "¡Tiempo terminado!" : c.estado === "paused" ? "En pausa" : "En curso";

  return (
    <div className="cm" data-estado={visual} role="group" aria-label="Cronómetro en curso">
      <button className="cm-main" onClick={abrir} title="Volver al cronómetro">
        <span className="cm-time" role="timer" aria-live="off">{formatoTiempo(c.restante)}</span>
        <span className="cm-info">
          <span className="cm-act">{c.actividad.trim() || "Cronómetro de actividad"}</span>
          <span className="cm-sub">{estadoTxt} · toca para abrir</span>
        </span>
        <i className="cm-bar" aria-hidden="true"><b style={{ width: `${prop * 100}%` }} /></i>
      </button>
      <div className="cm-ctrl">
        {c.estado !== "done" && (
          <button
            aria-label={c.estado === "running" ? "Pausar" : "Continuar"}
            title={c.estado === "running" ? "Pausar" : "Continuar"}
            onClick={() => (c.estado === "running" ? cronometro.pausar() : cronometro.continuar())}
          >
            {c.estado === "running" ? "⏸" : "▶"}
          </button>
        )}
        <button aria-label="Cerrar cronómetro" title="Cerrar y detener el cronómetro" onClick={() => cronometro.reiniciar()}>✕</button>
      </div>
    </div>
  );
}
