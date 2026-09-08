import { createHash, randomBytes } from "node:crypto";
import { VIRTUAL_KEY_PREFIX } from "@/lib/brand";

export function hashVirtualKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function issueVirtualKeyMaterial() {
  const raw = `${VIRTUAL_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return {
    raw,
    hash: hashVirtualKey(raw),
    prefix: raw.slice(0, 12),
  };
}
