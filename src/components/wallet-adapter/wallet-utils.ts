export function shortenAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function formatEthBalance(value: bigint, decimals = 18): string {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const fracStr = fraction.toString().padStart(decimals, "0").slice(0, 4);
  const result = `${whole}.${fracStr}`.replace(/\.?0+$/, "");
  return result || "0";
}

export function isUserRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: number | string; message?: string; name?: string };
  if (e.code === 4001 || e.code === "ACTION_REJECTED") return true;
  const msg = (e.message ?? e.name ?? "").toLowerCase();
  return (
    msg.includes("rejected") ||
    msg.includes("denied") ||
    msg.includes("cancel") ||
    msg.includes("user refused")
  );
}

export function walletErrorMessage(error: unknown): string {
  if (isUserRejection(error)) return "The wallet request was rejected.";
  if (error instanceof Error) return error.message;
  return "Connection failed. Try again.";
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "request_failed");
  }
  return data;
}

export function buildClientSiwsMessage(input: {
  address: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}) {
  return [
    `${window.location.host} wants you to sign in with your Solana account:`,
    input.address,
    "",
    `URI: ${window.location.origin}`,
    "Version: 1",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
  ].join("\n");
}
