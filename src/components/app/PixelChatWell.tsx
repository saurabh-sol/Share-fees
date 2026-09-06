"use client";

const TILES = [
  [0, 1, 1, 0, 0, 1, 1, 0],
  [1, 0, 0, 1, 1, 0, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [0, 1, 0, 1, 1, 0, 1, 0],
  [1, 0, 0, 1, 1, 0, 0, 1],
  [0, 1, 1, 0, 0, 1, 1, 0],
];

export function PixelChatWell({ talking }: { talking: boolean }) {
  return (
    <div aria-hidden className="hidden shrink-0 sm:block">
      <div className="grid grid-cols-8 gap-1">
        {TILES.flatMap((row, y) =>
          row.map((on, x) => (
            <span
              key={`${x}-${y}`}
              className={`size-2 ${
                on
                  ? talking
                    ? "bg-[#c23a3a]/50"
                    : "bg-zinc-500/35"
                  : "bg-transparent"
              }`}
            />
          )),
        )}
      </div>
    </div>
  );
}
