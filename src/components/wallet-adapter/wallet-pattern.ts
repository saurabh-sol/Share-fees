/** Deterministic pixel matrix for the background wallet artwork. */
export const PATTERN_WIDTH = 76;
export const PATTERN_HEIGHT = 52;

export type PixelKind = 0 | 1 | 2 | 3;

function hash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function inRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
): boolean {
  if (x < left || x > right || y < top || y > bottom) return false;
  const corners = [
    [left + radius, top + radius],
    [right - radius, top + radius],
    [left + radius, bottom - radius],
    [right - radius, bottom - radius],
  ] as const;
  for (const [cx, cy] of corners) {
    if (
      (x < left + radius && y < top + radius && (x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) ||
      (x > right - radius && y < top + radius && (x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) ||
      (x < left + radius && y > bottom - radius && (x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) ||
      (x > right - radius && y > bottom - radius && (x - cx) ** 2 + (y - cy) ** 2 > radius ** 2)
    ) {
      return false;
    }
  }
  return true;
}

function inDiamond(x: number, y: number, cx: number, cy: number, size: number): boolean {
  return Math.abs(x - cx) / size + Math.abs(y - cy) / (size * 0.65) <= 1;
}

function walletEnvelope(x: number, y: number): boolean {
  const body = inRoundedRect(x, y, 10, 14, 65, 46, 4);
  const flap = inRoundedRect(x, y, 18, 8, 57, 22, 3);
  const clasp = inRoundedRect(x, y, 30, 18, 46, 28, 2);
  return body || flap || clasp;
}

export function buildWalletPattern(): PixelKind[][] {
  const grid: PixelKind[][] = [];
  const cx = 38;
  const cy = 28;

  for (let y = 0; y < PATTERN_HEIGHT; y++) {
    const row: PixelKind[] = [];
    for (let x = 0; x < PATTERN_WIDTH; x++) {
      const inside = walletEnvelope(x, y);
      const diamond = inDiamond(x, y, cx, cy, 9);
      const edge =
        !walletEnvelope(x - 1, y) ||
        !walletEnvelope(x + 1, y) ||
        !walletEnvelope(x, y - 1) ||
        !walletEnvelope(x, y + 1);

      if (!inside) {
        row.push(0);
        continue;
      }

      const h = hash(x, y) % 100;
      if (diamond) {
        row.push(h < 8 ? 3 : h < 55 ? 2 : 1);
      } else if (edge) {
        row.push(h < 12 ? 3 : h < 45 ? 1 : 0);
      } else {
        row.push(h < 4 ? 3 : h < 35 ? 2 : h < 75 ? 1 : 0);
      }
    }
    grid.push(row);
  }
  return grid;
}

export const WALLET_PATTERN = buildWalletPattern();
