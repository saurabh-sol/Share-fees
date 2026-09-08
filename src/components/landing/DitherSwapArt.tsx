"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { DEFAULT_CONVERSION_BPS } from "@/lib/rules/constants";

const COLS = 56;
const ROWS = 56;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * Pixel-art token glyphs. Each entry is an inclusive [start, end] column span
 * per row (null = empty row); tones are resolved per pixel so facets and
 * dither gradients stay data-driven. Rendered as crisp SVG pixel grids in the
 * desk's zinc tones — no external icon CDNs.
 */
type PixelSpan = [number, number] | null;

const PIXEL_TONES = ["#e4e4e7", "rgba(228, 228, 231, 0.6)", "rgba(228, 228, 231, 0.32)"] as const;

// Ethereum octahedron: light left facet, mid right facet, dimmer base.
const ETH_COLS = 15;
const ETH_SPANS: PixelSpan[] = [
  [7, 7],
  [6, 8],
  [6, 8],
  [5, 9],
  [5, 9],
  [4, 10],
  [4, 10],
  [3, 11],
  [2, 12],
  [1, 13],
  null,
  [2, 12],
  [4, 10],
  [5, 9],
  [6, 8],
  [7, 7],
];

function ethToneAt(x: number, y: number): number {
  if (y <= 9) return x <= 7 ? 0 : 1;
  return x <= 7 ? 1 : 2;
}

// Solana bars: three parallel slanted bars with a dithered left-to-right ramp.
const SOL_COLS = 16;
const SOL_SPANS: PixelSpan[] = [
  [4, 15],
  [3, 14],
  [2, 13],
  null,
  null,
  null,
  [2, 13],
  [1, 12],
  [0, 11],
  null,
  null,
  null,
  [4, 15],
  [3, 14],
  [2, 13],
];

function solToneAt(x: number, y: number): number {
  if (x < 5) return 1;
  if (x < 11) return (x + y) % 2 === 0 ? 0 : 1;
  return 0;
}

// Hover-state icons as string bitmaps: "." empty, "a"/"b"/"c" = palette 0/1/2.
const SWAP_TONES = PIXEL_TONES;
const COIN_TONES = ["#c23a3a", "rgba(194, 58, 58, 0.55)", "rgba(194, 58, 58, 0.28)"] as const;

// Two opposing pixel arrows — right over left — the classic swap mark.
const SWAP_ROWS = [
  "................",
  "................",
  "..........a.....",
  "..........aa....",
  ".aaaaaaaaaaaa...",
  ".aaaaaaaaaaaa...",
  "..........aa....",
  "..........a.....",
  ".....a..........",
  "....aa..........",
  "...aaaaaaaaaaaa.",
  "...aaaaaaaaaaaa.",
  "....aa..........",
  ".....a..........",
  "................",
  "................",
];

// Two stacked pixel coins; the back coin sits dimmer for depth.
const COINS_ROWS = [
  "................",
  "................",
  "................",
  "...bbbbbb.......",
  ".bbccccccbb.....",
  ".bccccccccb.....",
  ".bccccccccb.....",
  ".bbccccaaaaaa...",
  "...bbaabbbbbbaa.",
  ".....abbbbbbbba.",
  ".....abbbbbbbba.",
  ".....aabbbbbbaa.",
  ".......aaaaaa...",
  "................",
  "................",
  "................",
];

function PixelIconGlyph({
  rows,
  palette,
  className,
}: {
  rows: string[];
  palette: readonly [string, string, string];
  className: string;
}) {
  const toneIndex: Record<string, number> = { a: 0, b: 1, c: 2 };
  const rects: React.ReactNode[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const tone = toneIndex[row[x]!];
      if (tone === undefined) continue;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x + 0.08}
          y={y + 0.08}
          width={0.84}
          height={0.84}
          fill={palette[tone]}
        />,
      );
    }
  });
  return (
    <svg
      viewBox={`0 0 ${rows[0]!.length} ${rows.length}`}
      shapeRendering="crispEdges"
      className={className}
      aria-hidden
    >
      {rects}
    </svg>
  );
}

function PixelTokenGlyph({
  spans,
  cols,
  toneAt,
}: {
  spans: PixelSpan[];
  cols: number;
  toneAt: (x: number, y: number) => number;
}) {
  const rects: React.ReactNode[] = [];
  spans.forEach((span, y) => {
    if (!span) return;
    for (let x = span[0]; x <= span[1]; x += 1) {
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x + 0.08}
          y={y + 0.08}
          width={0.84}
          height={0.84}
          fill={PIXEL_TONES[toneAt(x, y)]}
        />,
      );
    }
  });
  return (
    <svg
      viewBox={`0 0 ${cols} ${spans.length}`}
      shapeRendering="crispEdges"
      className="h-10 w-10 sm:h-14 sm:w-14"
      aria-hidden
    >
      {rects}
    </svg>
  );
}

function rot(x: number, y: number, a: number) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c] as const;
}

export function DitherSwapArt() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pairRef = useRef<HTMLParagraphElement>(null);
  const stateRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef(0);
  const targetHover = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = 440;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = size / COLS;
    let alive = true;

    const tick = (now: number) => {
      if (!alive) return;
      hoverRef.current += (targetHover.current - hoverRef.current) * 0.1;
      const mix = hoverRef.current;
      const angle = reduce ? 0 : now / 1000 * 0.12;

      ctx.clearRect(0, 0, size, size);
      for (let j = 0; j < ROWS; j += 1) {
        for (let i = 0; i < COLS; i += 1) {
          const u = (i + 0.5) / COLS;
          const v = (j + 0.5) / ROWS;
          let x = (u - 0.5) * 2;
          let y = (v - 0.5) * 2;
          [x, y] = rot(x, y, angle);
          const disc = 0.72 - Math.hypot(x, y) * 0.62;
          if (disc <= 0) continue;
          const threshold = ((BAYER[j % 4]![i % 4]! + 0.5) / 16) * 0.7;
          if (disc * (0.45 + mix * 0.2) <= threshold) continue;
          ctx.fillStyle = mix > 0.4 ? "rgba(194, 58, 58, 0.28)" : "rgba(228, 228, 231, 0.16)";
          const s = cell * 0.55;
          ctx.fillRect(i * cell + (cell - s) / 2, j * cell + (cell - s) / 2, s, s);
        }
      }

      const hovered = mix > 0.45;
      if (pairRef.current) pairRef.current.textContent = hovered ? "SWAP = CREDITS" : "ETH → SOL";
      if (stateRef.current) {
        stateRef.current.textContent = hovered ? "A qualifying fill writes LLM credits" : "A live pair, then the credit";
      }
      if (hintRef.current) hintRef.current.textContent = hovered ? "Credit path" : "Hover the field";
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame.current);
    };
  }, []);

  const setHover = (on: boolean) => {
    targetHover.current = on ? 1 : 0;
  };

  return (
    <figure
      className="group relative mx-auto w-full max-w-[480px] cursor-crosshair outline-none"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      tabIndex={0}
      aria-label="Ethereum to Solana swap, then swap equals LLM credits"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[02] Ratio tape</p>
        <span ref={hintRef} className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Hover the field
        </span>
      </div>

      <div className="relative mt-5 overflow-hidden border border-white/10 bg-raised/50">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <span className="absolute -left-px -top-px h-3 w-3 border-l border-t border-accent" />
        <span className="absolute -right-px -top-px h-3 w-3 border-r border-t border-accent" />
        <span className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-accent" />
        <span className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-accent" />
        <canvas ref={canvasRef} className="aspect-square h-auto w-full opacity-95" aria-hidden />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-4 transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0">
            <TokenFace label="ETH" name="Ethereum">
              <PixelTokenGlyph spans={ETH_SPANS} cols={ETH_COLS} toneAt={ethToneAt} />
            </TokenFace>
            <ArrowRight size={28} className="text-accent" />
            <TokenFace label="SOL" name="Solana">
              <PixelTokenGlyph spans={SOL_SPANS} cols={SOL_COLS} toneAt={solToneAt} />
            </TokenFace>
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="flex flex-col items-center gap-2">
              <PixelIconGlyph rows={SWAP_ROWS} palette={SWAP_TONES} className="h-9 w-9" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-100">Swap</span>
            </div>
            <span className="font-mono text-2xl text-zinc-500">=</span>
            <div className="flex flex-col items-center gap-2">
              <PixelIconGlyph rows={COINS_ROWS} palette={COIN_TONES} className="h-9 w-9" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Credits</span>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-6 grid grid-cols-[1fr_auto] items-end gap-6 border-t border-white/8 pt-5">
        <div>
          <p ref={pairRef} className="font-mono text-2xl tracking-tight text-zinc-100 md:text-[2rem]">
            ETH → SOL
          </p>
          <p ref={stateRef} className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            A live pair, then the credit
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl tabular-nums tracking-tighter text-accent md:text-[2.75rem]">
            {DEFAULT_CONVERSION_BPS}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">bps out</p>
        </div>
      </figcaption>
    </figure>
  );
}

function TokenFace({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-20 flex-col items-center gap-2.5 sm:w-28">
      <span className="flex h-14 w-14 items-center justify-center border border-white/12 bg-background/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-300 group-hover:scale-[1.02] sm:h-20 sm:w-20">
        {children}
      </span>
      <span className="font-mono text-sm tracking-[0.16em] text-zinc-100">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{name}</span>
    </div>
  );
}
