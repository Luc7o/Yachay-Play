import React from "react";
import { useClaseDestino, limpiarClaseDestino } from "../claseDestino";

// Aviso flotante mientras el docente prepara una actividad desde una clase:
// "Esta actividad quedará en la clase X". Se monta en main.jsx, fuera de <App/>,
// así se ve en cualquier pantalla de configuración sin tocar cada juego.
export function AvisoDestino() {
  const destino = useClaseDestino();
  if (!destino) return null;
  return (
    <div className="cp cp-destino" role="status">
      <span>
        Esta actividad quedará en la clase <b>{destino.name}</b>
      </span>
      <button type="button" onClick={limpiarClaseDestino}>
        Quitar
      </button>
    </div>
  );
}
