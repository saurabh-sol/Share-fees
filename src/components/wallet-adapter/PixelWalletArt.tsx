"use client";

import { WALLET_PATTERN, PATTERN_WIDTH, PATTERN_HEIGHT } from "./wallet-pattern";

const CELL = 7;

export function PixelWalletArt() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[18%] z-0 hidden -translate-x-1/2 md:block"
      aria-hidden
    >
      <div
        className="relative opacity-80"
        style={{
          width: PATTERN_WIDTH * CELL,
          height: PATTERN_HEIGHT * CELL,
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${PATTERN_WIDTH}, ${CELL}px)`,
            gridTemplateRows: `repeat(${PATTERN_HEIGHT}, ${CELL}px)`,
          }}
        >
          {WALLET_PATTERN.flatMap((row, y) =>
            row.map((kind, x) => {
              if (kind === 0) return null;
              const opacity = kind === 1 ? 0.15 : kind === 2 ? 0.35 : 0.9;
              const bg =
                kind === 3 ? "#c23a3a" : kind === 2 ? "#d4d4d8" : "#a1a1aa";
              return (
                <span
                  key={`${x}-${y}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    backgroundColor: bg,
                    opacity,
                  }}
                />
              );
            }),
          )}
        </div>
        {[
          [0.06, 0.15],
          [0.94, 0.12],
          [0.08, 0.85],
          [0.92, 0.88],
        ].map(([left, top], i) => (
          <span
            key={i}
            className="absolute font-mono text-[10px] text-zinc-700"
            style={{ left: `${left * 100}%`, top: `${top * 100}%` }}
          >
            +
          </span>
        ))}
      </div>
    </div>
  );
}

export function PixelWalletArtMobile() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-12 z-0 -translate-x-1/2 opacity-30 md:hidden"
      aria-hidden
    >
      <div
        className="grid origin-top scale-50"
        style={{
          gridTemplateColumns: `repeat(${PATTERN_WIDTH}, 5px)`,
          gridTemplateRows: `repeat(${PATTERN_HEIGHT}, 5px)`,
        }}
      >
        {WALLET_PATTERN.flatMap((row, y) =>
          row.map((kind, x) => {
            if (kind === 0 || kind === 1) return null;
            return (
              <span
                key={`m-${x}-${y}`}
                style={{
                  width: 5,
                  height: 5,
                  backgroundColor: kind === 3 ? "#c23a3a" : "#a1a1aa",
                  opacity: kind === 3 ? 0.8 : 0.3,
                }}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
