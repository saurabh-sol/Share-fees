/**
 * Local desk only. Vercel Cron hits the same job routes in production.
 * register() must return before the server accepts traffic, so ticks are scheduled, not awaited.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NODE_ENV !== "development") return;

  const secret = process.env.CRON_SECRET;
  if (!secret) return;

  const origin = (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
  const headers = { authorization: `Bearer ${secret}` };

  const tick = async () => {
    for (const path of [
      "/api/v1/jobs/payouts",
      "/api/v1/jobs/settles",
      "/api/v1/jobs/holder",
      "/api/v1/jobs/ai-create",
    ]) {
      try {
        await fetch(`${origin}${path}`, { headers, cache: "no-store" });
      } catch {
        // Server may still be binding on the first tick.
      }
    }
  };

  setTimeout(() => {
    void tick();
  }, 8_000);
  setInterval(() => {
    void tick();
  }, 60_000);
}
