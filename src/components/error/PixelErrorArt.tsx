"use client";

import { useEffect, useRef } from "react";

const COLS = 48;
const ROWS = 28;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const GLYPHS: Record<string, number[][]> = {
  "4": [
    [1, 0, 0, 1, 0],
    [1, 0, 0, 1, 0],
    [1, 1, 1, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
  ],
  "0": [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
};

function stamp(field: Uint8Array, ch: string, ox: number, oy: number) {
  const glyph = GLYPHS[ch];
  if (!glyph) return;
  for (let y = 0; y < glyph.length; y += 1) {
    for (let x = 0; x < (glyph[y]?.length ?? 0); x += 1) {
      if (!glyph[y]![x]) continue;
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const px = ox + x * 2 + dx;
          const py = oy + y * 2 + dy;
          if (px >= 0 && px < COLS && py >= 0 && py < ROWS) {
            field[py * COLS + px] = 2;
          }
        }
      }
    }
  }
}

export function PixelErrorArt({ label = "404" }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let width = 0;
    let height = 0;
    let frame = 0;
    let alive = true;

    const field = new Uint8Array(COLS * ROWS);
    const word = label.replace(/[^40]/g, "").slice(0, 3) || "404";
    const glyphW = 10;
    const startX = Math.floor((COLS - word.length * (glyphW + 2) + 2) / 2);
    const startY = 7;
    word.split("").forEach((ch, i) => stamp(field, ch, startX + i * (glyphW + 2), startY));

    const draw = (now: number) => {
      if (!alive) return;
      const t = reduce ? 0 : now / 900;
      ctx.clearRect(0, 0, width, height);
      const cell = width / COLS;
      for (let j = 0; j < ROWS; j += 1) {
        for (let i = 0; i < COLS; i += 1) {
          const kind = field[j * COLS + i];
          const u = (i + 0.5) / COLS;
          const v = (j + 0.5) / ROWS;
          const n = Math.sin(u * 9 + t) * Math.cos(v * 7 - t * 0.7);
          const threshold = ((BAYER[j % 4]![i % 4]! + 0.5) / 16) * 0.85;
          const dust = 0.22 + n * 0.12;
          if (!kind && dust <= threshold) continue;
          if (kind === 2) {
            ctx.fillStyle = "#c23a3a";
          } else {
            ctx.fillStyle = "rgba(228, 228, 231, 0.14)";
          }
          const s = cell * (kind === 2 ? 0.78 : 0.42);
          ctx.fillRect(i * cell + (cell - s) / 2, j * cell + (cell - s) / 2, s, s);
        }
      }
      frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      const box = canvas.parentElement?.getBoundingClientRect();
      width = Math.max(280, Math.floor(box?.width ?? 320));
      height = Math.floor(width * (ROWS / COLS));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [label]);

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto block h-auto w-full max-w-[720px]"
      aria-hidden
    />
  );
}
