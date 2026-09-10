import { env } from "@/lib/env";
import { AiCreateError } from "@/lib/ai-create/errors";

export type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  metrics?: Record<string, unknown>;
};

const REPLICATE_API = "https://api.replicate.com/v1";

function authHeaders(extra?: Record<string, string>) {
  const token = env.replicateApiToken;
  if (!token) {
    throw new AiCreateError("ai_create_unconfigured", 503);
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function parseReplicateResponse(response: Response) {
  const data = (await response.json()) as ReplicatePrediction & {
    detail?: string;
    title?: string;
  };
  if (!response.ok) {
    throw new AiCreateError(
      data.detail ?? data.title ?? `replicate_${response.status}`,
      response.status >= 500 ? 502 : 400,
    );
  }
  return data;
}

export function assertReplicateConfigured() {
  if (!env.aiCreateEnabled || !env.replicateApiToken) {
    throw new AiCreateError("ai_create_disabled", 503);
  }
}

export async function createModelPrediction(
  modelSlug: string,
  input: Record<string, unknown>,
  options?: { waitSeconds?: number; webhookUrl?: string },
) {
  assertReplicateConfigured();
  const [owner, name] = modelSlug.split("/");
  if (!owner || !name) {
    throw new AiCreateError("invalid_model_slug");
  }

  const headers = authHeaders(
    options?.waitSeconds
      ? { Prefer: `wait=${Math.min(Math.max(options.waitSeconds, 1), 60)}` }
      : undefined,
  );

  const payload: Record<string, unknown> = { input };
  if (options?.webhookUrl) {
    payload.webhook = options.webhookUrl;
    payload.webhook_events_filter = ["completed"];
  }

  const response = await fetch(`${REPLICATE_API}/models/${owner}/${name}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return parseReplicateResponse(response);
}

export async function getPrediction(predictionId: string) {
  assertReplicateConfigured();
  const response = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  return parseReplicateResponse(response);
}

export function normalizePredictionOutput(output: unknown): string[] {
  if (output == null) return [];
  if (typeof output === "string") return [output];
  if (Array.isArray(output)) {
    return output.filter((item): item is string => typeof item === "string");
  }
  if (typeof output === "object" && output !== null) {
    const maybeUrl = (output as { url?: string }).url;
    if (typeof maybeUrl === "string") return [maybeUrl];
  }
  return [];
}

export function mapReplicateStatus(
  status: ReplicatePrediction["status"],
): "processing" | "succeeded" | "failed" | "canceled" {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  if (status === "canceled") return "canceled";
  return "processing";
}
