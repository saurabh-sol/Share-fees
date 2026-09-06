"use client";

import { useEffect, useRef } from "react";

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function hash(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export function FooterField() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let alive = true;
    let frame = 0;
    let last = 0;
    let cols = 0;
    let rows = 0;
    let pitch = 10;
    let width = 0;
    let height = 0;

    const layout = () => {
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      if (width < 40 || height < 40) return;
      pitch = width < 720 ? 9 : 11;
      cols = Math.ceil(width / pitch);
      rows = Math.ceil(height / pitch);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paint = (now: number) => {
      if (!alive || !cols || !rows) return;
      const t = reduce ? 0 : now / 1000;
      ctx.clearRect(0, 0, width, height);

      const block = 7;
      for (let j = 0; j < rows; j += 1) {
        for (let i = 0; i < cols; i += 1) {
          const bx = Math.floor(i / block);
          const by = Math.floor(j / block);
          const seed = hash(bx, by * 3.1);
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.32 + seed * 6.2832 + bx * 0.35 - by * 0.2);
          const band = 0.55 + 0.45 * Math.sin((i / cols) * 2.2 + t * 0.08);
          const density = 0.1 + seed * 0.34 + pulse * 0.1 * band;
          const threshold = (BAYER[j & 3]![i & 3]! + 0.5) / 16;
          if (density * 0.92 <= threshold * 0.85) continue;

          const u = i / cols;
          const v = j / rows;
          const vignette = Math.min(1, Math.min(u, 1 - u, v, 1 - v) * 3.4);
          const size = pitch * (0.18 + density * 0.62);
          const x = i * pitch + (pitch - size) / 2;
          const y = j * pitch + (pitch - size) / 2;
          const accent = seed > 0.86 && pulse > 0.72;
          const alpha = (accent ? 0.2 : 0.14 + density * 0.2) * vignette;
          ctx.fillStyle = accent ? `rgba(194, 58, 58, ${alpha})` : `rgba(228, 228, 231, ${alpha})`;
          ctx.fillRect(x, y, size, size);
        }
      }
    };

    const tick = (now: number) => {
      if (!alive) return;
      if (now - last > 50) {
        paint(now);
        last = now;
      }
      if (!reduce) frame = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => {
      layout();
      paint(performance.now());
    });
    ro.observe(wrap);
    layout();
    paint(0);
    if (!reduce) frame = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
