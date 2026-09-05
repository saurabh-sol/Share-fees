import { env } from "@/lib/env";

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status = 401,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

export function assertAdmin(request: Request) {
  if (!env.adminSecret) {
    throw new AdminError("admin_disabled");
  }
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length < 16 || token !== env.adminSecret) {
    throw new AdminError("admin_unauthorized");
  }
}
