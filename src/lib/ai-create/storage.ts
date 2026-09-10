import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

function localOutputRoot() {
  const cwd = process.cwd();
  const base = cwd.startsWith("file:") ? new URL(cwd).pathname : cwd;
  return path.join(base, ".data", "ai-outputs");
}

function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).slice(1).toLowerCase();
    if (ext && ext.length <= 8) return ext;
  } catch {
    // fall through
  }
  return "bin";
}

function extensionFromContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  const value = contentType.split(";")[0]?.trim().toLowerCase();
  if (value === "image/png") return "png";
  if (value === "image/jpeg") return "jpg";
  if (value === "image/webp") return "webp";
  if (value === "image/gif") return "gif";
  if (value === "video/mp4") return "mp4";
  if (value === "video/webm") return "webm";
  if (value === "audio/mpeg") return "mp3";
  if (value === "audio/wav") return "wav";
  return null;
}

async function downloadSource(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`output_download_failed_${response.status}`);
  }
  const contentType = response.headers.get("content-type");
  const ext = extensionFromContentType(contentType) ?? extensionFromUrl(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, ext, contentType };
}

async function persistToLocal(jobId: string, sourceUrls: string[]) {
  const root = localOutputRoot();
  const jobDir = path.join(root, jobId);
  await fs.mkdir(jobDir, { recursive: true });

  const urls: string[] = [];
  for (let index = 0; index < sourceUrls.length; index += 1) {
    const sourceUrl = sourceUrls[index]!;
    const { bytes, ext } = await downloadSource(sourceUrl);
    const filename = `${index}.${ext}`;
    await fs.writeFile(path.join(jobDir, filename), bytes);
    urls.push(`${env.appOrigin.replace(/\/$/, "")}/api/v1/ai/assets/${jobId}/${filename}`);
  }
  return urls;
}

function r2Client() {
  if (!env.r2Configured) {
    throw new Error("r2_unconfigured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.r2AccessKeyId!,
      secretAccessKey: env.r2SecretAccessKey!,
    },
  });
}

async function persistToR2(jobId: string, sourceUrls: string[]) {
  const client = r2Client();
  const bucket = env.r2BucketName!;
  const publicBase = env.r2PublicUrl?.replace(/\/$/, "");

  const urls: string[] = [];
  for (let index = 0; index < sourceUrls.length; index += 1) {
    const sourceUrl = sourceUrls[index]!;
    const { bytes, ext, contentType } = await downloadSource(sourceUrl);
    const key = `ai-create/${jobId}/${index}.${ext}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType ?? undefined,
      }),
    );
    urls.push(publicBase ? `${publicBase}/${key}` : key);
  }
  return urls;
}

export async function persistJobOutputs(jobId: string, sourceUrls: string[]) {
  if (sourceUrls.length === 0) {
    return { urls: [] as string[], stored: false as const };
  }

  if (env.r2Configured) {
    return { urls: await persistToR2(jobId, sourceUrls), stored: true as const };
  }

  if (env.aiStorageLocal) {
    return { urls: await persistToLocal(jobId, sourceUrls), stored: true as const };
  }

  return { urls: sourceUrls, stored: false as const };
}

export function resolveLocalAssetPath(jobId: string, filename: string) {
  const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "");
  const root = localOutputRoot();
  const resolved = path.resolve(root, safeJobId, safeName);
  if (!resolved.startsWith(path.resolve(root))) {
    return null;
  }
  return resolved;
}
