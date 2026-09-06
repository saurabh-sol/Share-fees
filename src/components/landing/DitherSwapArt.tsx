"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, ArrowsClockwise, Coins } from "@phosphor-icons/react";

const COLS = 56;
const ROWS = 56;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const ETH_SRC = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/eth.png";
const SOL_SRC = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/sol.png";

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
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#c23a3a]">[02] Ratio tape</p>
        <span ref={hintRef} className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Hover the field
        </span>
      </div>

      <div className="relative mt-4 border border-white/10 bg-[#1c1c1f]/40">
        <span className="absolute -left-px -top-px h-3 w-3 border-l border-t border-[#c23a3a]" />
        <span className="absolute -right-px -top-px h-3 w-3 border-r border-t border-[#c23a3a]" />
        <span className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-[#c23a3a]" />
        <span className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-[#c23a3a]" />
        <canvas ref={canvasRef} className="aspect-square h-auto w-full" aria-hidden />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-4 transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0">
            <TokenFace src={ETH_SRC} label="ETH" name="Ethereum" />
            <ArrowRight size={28} className="text-[#c23a3a]" />
            <TokenFace src={SOL_SRC} label="SOL" name="Solana" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="flex flex-col items-center gap-2">
              <ArrowsClockwise size={36} className="text-zinc-100" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-100">Swap</span>
            </div>
            <span className="font-mono text-2xl text-zinc-500">=</span>
            <div className="flex flex-col items-center gap-2">
              <Coins size={36} className="text-[#c23a3a]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#c23a3a]">Credits</span>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-5 grid grid-cols-[1fr_auto] items-end gap-6 border-t border-white/8 pt-4">
        <div>
          <p ref={pairRef} className="font-mono text-2xl tracking-tight text-zinc-100 md:text-3xl">
            ETH → SOL
          </p>
          <p ref={stateRef} className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            A live pair, then the credit
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl tabular-nums tracking-tighter text-[#c23a3a] md:text-4xl">50</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">bps out</p>
        </div>
      </figcaption>
    </figure>
  );
}

function TokenFace({ src, label, name }: { src: string; label: string; name: string }) {
  return (
    <div className="flex w-20 flex-col items-center gap-2 sm:w-28">
      <span className="flex h-14 w-14 items-center justify-center border border-white/10 bg-[#141416] sm:h-20 sm:w-20">
        <img src={src} alt="" width={56} height={56} className="h-10 w-10 object-contain sm:h-14 sm:w-14" />
      </span>
      <span className="font-mono text-sm tracking-[0.16em] text-zinc-100">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{name}</span>
    </div>
  );
}
