// Ícono de un mini-crucigrama para el catálogo y la puerta de entrada
export function CwGridIcon() {
  return (
    <svg viewBox="0 0 100 100" className="game-icon-svg" aria-hidden="true">
      <rect x="6" y="6" width="88" height="88" rx="10" fill="#023A73" />
      {[
        [1, 0], [2, 0], [3, 0],
        [1, 1], [3, 1],
        [0, 2], [1, 2], [2, 2], [3, 2],
        [1, 3],
      ].map(([cx, cy], i) => (
        <rect key={i} x={14 + cx * 20} y={14 + cy * 20} width="18" height="18" rx="3" fill="#fff" />
      ))}
      <rect x={14 + 1 * 20} y={14 + 0 * 20} width="18" height="18" rx="3" fill="#00A99A" />
    </svg>
  );
}
