import { Icono } from "./Iconos";

// Botón cuadrado de la barra (fuera del componente para que no se recree en cada cambio)
export function Btn({ n, titulo, activo, onClick, disabled }) {
  return (
    <button className="pz-btn" title={titulo} aria-label={titulo} aria-pressed={activo === undefined ? undefined : activo} disabled={disabled} onClick={onClick}>
      <Icono n={n} />
    </button>
  );
}
