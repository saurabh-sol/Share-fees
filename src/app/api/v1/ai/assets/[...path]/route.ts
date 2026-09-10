import fs from "node:fs/promises";
import path from "node:path";
import { resolveLocalAssetPath } from "@/lib/ai-create/storage";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!env.aiStorageLocal) {
    return jsonError(404, "not_found", "Local AI asset storage is disabled.");
  }

  const segments = (await context.params).path;
  if (!segments || segments.length !== 2) {
    return jsonError(404, "not_found", "Asset not found.");
  }

  const [jobId, filename] = segments;
  const resolved = resolveLocalAssetPath(jobId, filename);
  if (!resolved) {
    return jsonError(404, "not_found", "Asset not found.");
  }

  try {
    const bytes = await fs.readFile(resolved);
    const ext = path.extname(filename).slice(1).toLowerCase();
    return new Response(bytes, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return jsonError(404, "not_found", "Asset not found.");
  }
}
