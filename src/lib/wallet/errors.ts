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
