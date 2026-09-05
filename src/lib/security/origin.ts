import { env } from "@/lib/env";

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (/^[0-9a-fA-F.:]+$/.test(first)) {
      return first;
    }
  }
  return "unknown";
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowed = new URL(env.appOrigin);

  if (origin) {
    const incoming = new URL(origin);
    if (incoming.origin !== allowed.origin) {
      throw new OriginError("origin_mismatch");
    }
    return;
  }

  if (referer) {
    const incoming = new URL(referer);
    if (incoming.origin !== allowed.origin) {
      throw new OriginError("referer_mismatch");
    }
    return;
  }

  throw new OriginError("missing_origin");
}

export class OriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OriginError";
  }
}

export function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: code, message }, { status });
}
