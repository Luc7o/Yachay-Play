import { useEffect, useRef, useState } from "react";
import { hoy, nombreSeguro } from "./utils";

// Cuadro "Guardar tu trabajo": nombre, formato y páginas
export function DialogoDescarga({ vista, nombreInicial, paginas, ocupado, onCancelar, onConfirmar }) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [formato, setFormato] = useState("png");
  const [alcance, setAlcance] = useState(paginas > 1 ? "todas" : "actual");
  const [fecha, setFecha] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);
  const esPdf = formato === "pdf";
  const alc = esPdf ? alcance : "actual";
  const archivo = nombreSeguro(nombre + (fecha ? ` ${hoy()}` : ""));
  const enviar = (e) => {
    e.preventDefault();
    if (!ocupado) onConfirmar({ nombre, archivo, formato, alcance: alc });
  };
  const FORMATOS = [
    ["png", "PNG", "Imagen nítida"],
    ["jpg", "JPG", "Más liviana"],
    ["pdf", "PDF", "Para imprimir o enviar"],
  ];
  return (
    <div
      className="pz-modal-fondo"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelar(); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancelar(); } }}
    >
      <form className="pz-modal" role="dialog" aria-modal="true" aria-labelledby="pz-dl-t" onSubmit={enviar}>
        <h2 id="pz-dl-t">Guardar tu trabajo</h2>
        <div className="pz-vista"><img src={vista} alt="Vista previa de la página actual" /></div>

        <label className="pz-lab" htmlFor="pz-dl-nombre">Nombre del trabajo</label>
        <input id="pz-dl-nombre" ref={inputRef} type="text" value={nombre} maxLength={80} placeholder="Ej.: Clase de fracciones" onChange={(e) => setNombre(e.target.value)} />
        <label className="pz-check">
          <input type="checkbox" checked={fecha} onChange={(e) => setFecha(e.target.checked)} /> Agregar la fecha al nombre
        </label>

        <div className="pz-lab">Formato</div>
        <div className="pz-chips" role="group" aria-label="Formato">
          {FORMATOS.map(([id, t, sub]) => (
            <button key={id} type="button" className="pz-chip" aria-pressed={formato === id} onClick={() => setFormato(id)}>
              <b>{t}</b><small>{sub}</small>
            </button>
          ))}
        </div>

        {esPdf && paginas > 1 && (
          <>
            <div className="pz-lab">Páginas</div>
            <div className="pz-chips pz-chips-2" role="group" aria-label="Páginas">
              <button type="button" className="pz-chip" aria-pressed={alcance === "actual"} onClick={() => setAlcance("actual")}><b>Solo esta</b></button>
              <button type="button" className="pz-chip" aria-pressed={alcance === "todas"} onClick={() => setAlcance("todas")}><b>Todas ({paginas})</b></button>
            </div>
          </>
        )}

        <p className="pz-archivo">Se guardará como <b>{archivo}.{formato}</b></p>
        <div className="pz-acciones">
          <button type="button" className="hr-btn" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="hr-btn hr-primary" disabled={ocupado}>{ocupado ? "Guardando…" : "Descargar"}</button>
        </div>
      </form>
    </div>
  );
}

// Miniatura de cada fondo para la lista (así se ve cómo es antes de elegirlo)
export function muestraFondo(f) {
  const l = "#C3D3E6";
  if (f.id === "cuadro") return { backgroundColor: f.color, backgroundImage: `linear-gradient(${l} 1px,transparent 1px),linear-gradient(90deg,${l} 1px,transparent 1px)` };
  if (f.id === "rayas") return { backgroundColor: f.color, backgroundImage: `linear-gradient(${l} 1px,transparent 1px)` };
  if (f.id === "plano") return { backgroundColor: f.color, backgroundImage: `linear-gradient(#334155 0 0),linear-gradient(#334155 0 0),linear-gradient(${l} 1px,transparent 1px),linear-gradient(90deg,${l} 1px,transparent 1px)`, backgroundSize: "100% 2px,2px 100%,8px 8px,8px 8px", backgroundPosition: "0 50%,50% 0,0 0,0 0", backgroundRepeat: "no-repeat,no-repeat,repeat,repeat" };
  return { backgroundColor: f.color };
}
