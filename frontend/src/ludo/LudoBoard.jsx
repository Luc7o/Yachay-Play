import { useMemo } from "react";
import { RING, START_INDEX, HOME_COLUMNS, SAFE_INDEXES, cellForStep, cellKey } from "../board";
import { COLORS, TURN_ORDER } from "../constants";

// Índice del anillo -> color, si esa casilla es la salida de algún equipo
export const START_CELL_COLOR = {};
TURN_ORDER.forEach((t) => {
  START_CELL_COLOR[START_INDEX[t]] = t;
});

export function LudoBoard({ players, positions = {}, activeTeams = TURN_ORDER, small }) {
  // Red de seguridad extra: si llega un array vacío (no undefined), también caemos a TURN_ORDER.
  if (!activeTeams.length) activeTeams = TURN_ORDER;
  // Agrupamos las fichas por casilla: "fila,columna" -> [jugadores]
  const piecesByCell = useMemo(() => {
    const m = {};
    players.forEach((p) => {
      const step = positions[p.id] ?? -1;
      if (step < 0) return; // sigue en casa, se dibuja en su cuadrado
      const cell = cellForStep(p.team, step);
      if (cell) (m[cellKey(cell)] ??= []).push(p);
    });
    return m;
  }, [players, positions]);

  const piecesAt = (cell) => piecesByCell[cellKey(cell)] || [];

  return (
    <div className={`ludo-board ${small ? "small" : ""}`}>
      {/* --- Las 4 casas (cuadrados de 6x6 en las esquinas) --- */}
      <BaseBox color="rojo" row={1} col={1} players={players} positions={positions} activeTeams={activeTeams} />
      <BaseBox color="verde" row={1} col={10} players={players} positions={positions} activeTeams={activeTeams} />
      <BaseBox color="azul" row={10} col={1} players={players} positions={positions} activeTeams={activeTeams} />
      <BaseBox color="amarillo" row={10} col={10} players={players} positions={positions} activeTeams={activeTeams} />

      {/* --- Las 52 casillas del anillo exterior --- */}
      {RING.map(([r, c], i) => {
        const startColor = START_CELL_COLOR[i];
        const isSafe = SAFE_INDEXES.includes(i);
        const here = piecesAt([r, c]);
        return (
          <div
            key={`ring-${i}`}
            className={`cell ring ${isSafe ? "safe" : ""}`}
            style={{
              gridRow: r + 1,
              gridColumn: c + 1,
              background: startColor ? COLORS[startColor].soft : "#fff",
              borderColor: startColor ? COLORS[startColor].hex : "#cbd5e1",
            }}
          >
            {isSafe && here.length === 0 && <span className="star">★</span>}
            <Tokens list={here} />
          </div>
        );
      })}

      {/* --- Las 4 rectas finales de 5 casillas --- */}
      {TURN_ORDER.map((color) =>
        HOME_COLUMNS[color].map(([r, c], i) => (
          <div
            key={`home-${color}-${i}`}
            className="cell home-lane"
            style={{ gridRow: r + 1, gridColumn: c + 1, background: COLORS[color].hex }}
          >
            <Tokens list={piecesAt([r, c])} />
          </div>
        ))
      )}

      {/* --- El centro: la META --- */}
      <div className="center-goal" style={{ gridRow: "7 / 10", gridColumn: "7 / 10" }}>
        <i className="tri tri-left" style={{ background: COLORS.rojo.hex }} />
        <i className="tri tri-top" style={{ background: COLORS.verde.hex }} />
        <i className="tri tri-right" style={{ background: COLORS.amarillo.hex }} />
        <i className="tri tri-bottom" style={{ background: COLORS.azul.hex }} />
        <div className="goal-inner">
          <span className="goal-cup">🏆</span>
          <Tokens list={piecesAt([7, 7])} />
        </div>
      </div>
    </div>
  );
}

// Fichas dibujadas dentro de una casilla (pueden ser varias apiladas)
export function Tokens({ list }) {
  if (!list.length) return null;
  return (
    <div className="tokens">
      {list.map((p) => (
        <span
          key={p.id}
          className="board-piece"
          title={`${p.name} (${COLORS[p.team].name})`}
          style={{ background: COLORS[p.team].hex }}
        >
          {p.name.trim()[0]?.toUpperCase() || "?"}
        </span>
      ))}
    </div>
  );
}

// La casa de un color: 4 huecos donde esperan las fichas que aún no salieron
export function BaseBox({ color, row, col, players, positions, activeTeams = TURN_ORDER }) {
  if (!activeTeams.length) activeTeams = TURN_ORDER;
  const mine = players.filter((p) => p.team === color);
  const atHome = mine.filter((p) => (positions[p.id] ?? -1) < 0);
  const juega = activeTeams.includes(color);
  return (
    <div
      className={`base-box ${juega ? "" : "base-off"}`}
      style={{
        gridRow: `${row} / span 6`,
        gridColumn: `${col} / span 6`,
        background: COLORS[color].soft,
        borderColor: COLORS[color].hex,
      }}
    >
      <div className="base-inner">
        {[0, 1, 2, 3].map((i) => (
          <div className="base-slot" key={i} style={{ borderColor: COLORS[color].hex }}>
            {atHome[i] && (
              <span className="board-piece" title={atHome[i].name} style={{ background: COLORS[color].hex }}>
                {atHome[i].name.trim()[0]?.toUpperCase() || "?"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
