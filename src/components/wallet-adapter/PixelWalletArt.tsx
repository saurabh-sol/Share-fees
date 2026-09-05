"use client";

import { WALLET_PATTERN, PATTERN_WIDTH, PATTERN_HEIGHT } from "./wallet-pattern";

const CELL = 5;
const COLORS = {
  1: { fill: "#9a9aa3", opacity: 0.22 },
  2: { fill: "#d6d6db", opacity: 0.55 },
  3: { fill: "#c23a3a", opacity: 0.92 },
} as const;

const CROSSES = [
  [0.04, 0.18],
  [0.96, 0.14],
  [0.08, 0.78],
  [0.93, 0.84],
  [0.18, 0.08],
  [0.82, 0.06],
];

export function PixelWalletArt() {
  const width = PATTERN_WIDTH * CELL;
  const height = PATTERN_HEIGHT * CELL;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[6%] z-0 hidden -translate-x-1/2 md:block"
      aria-hidden
      style={{ width, height }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {WALLET_PATTERN.map((row, y) =>
          row.map((kind, x) => {
            if (kind === 0) return null;
            const c = COLORS[kind];
            return (
              <rect
                key={`${x}-${y}`}
                x={x * CELL}
                y={y * CELL}
                width={CELL - 0.6}
                height={CELL - 0.6}
                fill={c.fill}
                opacity={c.opacity}
              />
            );
          }),
        )}
      </svg>
      {CROSSES.map(([left, top], i) => (
        <span
          key={i}
          className="absolute font-mono text-[9px] leading-none text-zinc-600"
          style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
        >
          +
        </span>
      ))}
    </div>
  );
}

export function PixelWalletArtMobile() {
  const cell = 3;
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-8 z-0 -translate-x-1/2 opacity-40 md:hidden"
      aria-hidden
    >
      <svg
        width={PATTERN_WIDTH * cell}
        height={PATTERN_HEIGHT * cell}
        viewBox={`0 0 ${PATTERN_WIDTH * cell} ${PATTERN_HEIGHT * cell}`}
      >
        {WALLET_PATTERN.map((row, y) =>
          row.map((kind, x) => {
            if (kind === 0 || kind === 1) return null;
            return (
              <rect
                key={`m-${x}-${y}`}
                x={x * cell}
                y={y * cell}
                width={cell - 0.4}
                height={cell - 0.4}
                fill={kind === 3 ? "#c23a3a" : "#a1a1aa"}
                opacity={kind === 3 ? 0.85 : 0.35}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}
