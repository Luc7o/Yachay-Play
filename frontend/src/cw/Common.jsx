// Grupo de botones para elegir un valor (mismo patrón que en la configuración de Ludo)
export const Step = ({ n, t, d }) => (
  <div className="preview-step">
    <b>{n}</b>
    <div>
      <strong>{t}</strong>
      <p>{d}</p>
    </div>
  </div>
);

export function Options({ value, options, onChange, format }) {
  return (
    <div className="cfg-chips" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          role="radio"
          aria-checked={o === value}
          className={"cfg-chip" + (o === value ? " on" : "")}
          onClick={() => onChange(o)}
        >
          {format ? format(o) : o}
        </button>
      ))}
    </div>
  );
}
