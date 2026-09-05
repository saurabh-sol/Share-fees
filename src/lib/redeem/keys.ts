import { createHash, randomBytes } from "node:crypto";

export function hashVirtualKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function issueVirtualKeyMaterial() {
  const raw = `t2c_${randomBytes(24).toString("hex")}`;
  return {
    raw,
    hash: hashVirtualKey(raw),
    prefix: raw.slice(0, 12),
  };
}
