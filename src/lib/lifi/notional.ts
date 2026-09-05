export function usdToCents(raw: string | number): number {
  const value = typeof raw === "number" ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("invalid_usd");
  }
  return Math.round(value * 100);
}

export function addressesEqual(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
