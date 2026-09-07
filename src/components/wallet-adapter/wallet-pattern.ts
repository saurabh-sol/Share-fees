/** Folder-style wallet in 3/4 view, dithered like the reference. */

export const PATTERN_WIDTH = 148;
export const PATTERN_HEIGHT = 108;

/**
 * 0 empty · 1 dim body · 2 bright body · 3 accent fleck ·
 * 4/5/6 ETH mark facets (bright / mid / dim) — kept separate from body
 * kinds so renderers can keep the mark legible at any size.
 */
export type PixelKind = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

type Pt = { x: number; y: number };

function hash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663) ^ 83492791) >>> 0;
}

function cross(a: Pt, b: Pt, p: Pt): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function inQuad(p: Pt, a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const s1 = cross(a, b, p);
  const s2 = cross(b, c, p);
  const s3 = cross(c, d, p);
  const s4 = cross(d, a, p);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0 && s4 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0 && s4 <= 0);
}

function distToEdges(p: Pt, a: Pt, b: Pt, c: Pt, d: Pt): number {
  const edges: [Pt, Pt][] = [
    [a, b],
    [b, c],
    [c, d],
    [d, a],
  ];
  let min = Infinity;
  for (const [s, e] of edges) {
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / len2));
    const px = s.x + t * dx;
    const py = s.y + t * dy;
    min = Math.min(min, Math.hypot(p.x - px, p.y - py));
  }
  return min;
}

/**
 * The exact pixel-ETH octahedron used in the landing hero
 * (src/components/landing/DitherSwapArt.tsx): inclusive [start, end]
 * column spans per row, null = the gap row between the two halves.
 */
const ETH_GLYPH_COLS = 15;
const ETH_GLYPH_SPANS: Array<[number, number] | null> = [
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
const ETH_GLYPH_ROWS = ETH_GLYPH_SPANS.length;
const ETH_GLYPH_SCALE = 2;

/** Returns 0 when outside the mark, otherwise facet kind 4 (bright) / 5 (mid) / 6 (dim). */
function ethMarkKind(x: number, y: number, cx: number, cy: number): PixelKind {
  const left = cx - (ETH_GLYPH_COLS * ETH_GLYPH_SCALE) / 2;
  const top = cy - (ETH_GLYPH_ROWS * ETH_GLYPH_SCALE) / 2;
  const gx = Math.floor((x - left) / ETH_GLYPH_SCALE);
  const gy = Math.floor((y - top) / ETH_GLYPH_SCALE);
  if (gx < 0 || gx >= ETH_GLYPH_COLS || gy < 0 || gy >= ETH_GLYPH_ROWS) return 0;
  const span = ETH_GLYPH_SPANS[gy];
  if (!span || gx < span[0] || gx > span[1]) return 0;
  // Same facet tones as the hero: light left / mid right, dimmer base.
  if (gy <= 9) return gx <= 7 ? 4 : 5;
  return gx <= 7 ? 5 : 6;
}

export function buildWalletPattern(): PixelKind[][] {
  const width = PATTERN_WIDTH;
  const height = PATTERN_HEIGHT;

  const fl: Pt = { x: 26, y: 30 };
  const fr: Pt = { x: 112, y: 20 };
  const br: Pt = { x: 120, y: 80 };
  const bl: Pt = { x: 34, y: 90 };

  const tl: Pt = { x: 18, y: 20 };
  const tr: Pt = { x: 102, y: 10 };

  const sr: Pt = { x: 128, y: 70 };
  const st: Pt = { x: 110, y: 10 };

  const ethCx = 72;
  const ethCy = 52;

  const grid: PixelKind[][] = [];

  for (let y = 0; y < height; y++) {
    const row: PixelKind[] = [];
    for (let x = 0; x < width; x++) {
      const p = { x, y };
      const front = inQuad(p, fl, fr, br, bl);
      const top = inQuad(p, tl, tr, fr, fl);
      const side = inQuad(p, fr, st, sr, br);
      const mark = front ? ethMarkKind(x, y, ethCx, ethCy) : 0;

      if (!front && !top && !side) {
        row.push(0);
        continue;
      }

      let light = 0.42;
      if (front) {
        const edge = distToEdges(p, fl, fr, br, bl);
        light = 0.5 + (1 - y / height) * 0.16 + (1 - x / width) * 0.06;
        if (edge < 1.4) light = 0.32;
      } else if (top) {
        light = 0.74 - (x / width) * 0.1;
      } else {
        light = 0.26 + (1 - y / height) * 0.1;
      }

      const n = (hash(x, y) % 1000) / 1000;
      const threshold = BAYER[y % 4][x % 4] / 16;
      const fadeX = x < 18 ? x / 18 : x > width - 16 ? (width - x) / 16 : 1;
      const fadeY = y < 14 ? y / 14 : y > height - 12 ? (height - y) / 12 : 1;
      const value = light * fadeX * fadeY - threshold * 0.2 - n * 0.07;

      if (mark) {
        row.push(mark);
        continue;
      }

      if (value < 0.18) {
        row.push(0);
      } else if (n < 0.028 && value > 0.3) {
        row.push(3);
      } else if (value > 0.64) {
        row.push(2);
      } else {
        row.push(1);
      }
    }
    grid.push(row);
  }

  return grid;
}

export const WALLET_PATTERN = buildWalletPattern();
