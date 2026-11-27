import { useEffect, useState } from "react";

// ==================== EL DADO (con animación) ====================
// Cada cara se dibuja con puntos en una cuadrícula de 3x3.
// PIPS dice qué posiciones (0 a 8) llevan punto en cada cara.
export const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice({ value, rolling, size = "big" }) {
  const [face, setFace] = useState(value || 1);

  // Mientras "rolling" es true cambiamos de cara cada 90ms: eso es la animación.
  useEffect(() => {
    if (!rolling) {
      if (value) setFace(value);
      return;
    }
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    return () => clearInterval(id);
  }, [rolling, value]);

  const shown = rolling ? face : value;
  return (
    <div className={`dice ${size} ${rolling ? "dice-rolling" : ""}`}>
      {shown ? (
        <div className="dice-face">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={PIPS[shown].includes(i) ? "pip on" : "pip"} />
          ))}
        </div>
      ) : (
        <span className="dice-empty">?</span>
      )}
    </div>
  );
}
