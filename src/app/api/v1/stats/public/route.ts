import { getPublicDeskStats } from "@/lib/stats/public";
import { clientIp } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  try {
    await rateLimitOrThrow(`stats-public:${clientIp(request)}`, 60, 15 * 60 * 1000);
    const stats = await getPublicDeskStats();
    if (!stats) {
      return Response.json({ ok: false, message: "stats_unavailable" }, { status: 503 });
    }
    return Response.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ ok: false, message: "rate_limited" }, { status: 429 });
    }
    return Response.json({ ok: false, message: "stats_failed" }, { status: 503 });
  }
}
