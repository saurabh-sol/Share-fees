"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NotchedButton } from "@/components/ui/NotchedButton";
import { EmptyState } from "@/components/ui/EmptyState";

type AiModel = {
  id: string;
  category: string;
  displayName: string;
  maxCostCents: number;
  inputSchema: Record<string, { type: string; required?: boolean; enum?: string[]; default?: string }>;
};

type AiJob = {
  id: string;
  modelId: string;
  modelName: string;
  category: string;
  status: string;
  estimatedCostCents: number;
  finalCostCents: number | null;
  input: Record<string, unknown>;
  outputUrls: string[];
  error: string | null;
  createdAt: string;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function newIdempotencyKey() {
  return `aic_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json()) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "request_failed");
  }
  return data;
}

export function AiCreateDesk({
  initialJobs,
  initialDisplayCents,
  initialSpendableCents,
  enabled,
}: {
  initialJobs: AiJob[];
  initialDisplayCents: number;
  initialSpendableCents: number;
  enabled: boolean;
}) {
  const [category, setCategory] = useState<"image" | "video" | "audio">("image");
  const [models, setModels] = useState<AiModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [jobs, setJobs] = useState(initialJobs);
  const [displayCents, setDisplayCents] = useState(initialDisplayCents);
  const [spendableCents, setSpendableCents] = useState(initialSpendableCents);
  const [phase, setPhase] = useState<"idle" | "generating" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedModel = useMemo(
    () => models.find((row) => row.id === modelId) ?? null,
    [models, modelId],
  );

  useEffect(() => {
    if (!enabled || category === "audio") return;
    void readJson<{ models: AiModel[] }>(`/api/v1/ai/models?category=${category}`)
      .then((data) => {
        setModels(data.models);
        setModelId((current) => current || data.models[0]?.id || "");
      })
      .catch(() => setModels([]));
  }, [category, enabled]);

  async function refreshBalance() {
    const data = await readJson<{ displayCents: number; spendableCents: number }>("/api/v1/ai/balance");
    setDisplayCents(data.displayCents);
    setSpendableCents(data.spendableCents);
  }

  async function refreshJobs() {
    const data = await readJson<{ jobs: AiJob[] }>("/api/v1/ai/jobs");
    setJobs(data.jobs);
  }

  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void readJson<{ job: AiJob }>(`/api/v1/ai/jobs/${activeJobId}`)
        .then(async (data) => {
          if (cancelled) return;
          if (data.job.status === "succeeded") {
            setPhase("success");
            setPreviewUrl(data.job.outputUrls[0] ?? null);
            setMessage(`Generation complete. Charged ${money(data.job.finalCostCents ?? 0)}.`);
            setActiveJobId(null);
            await refreshJobs();
            await refreshBalance();
          } else if (data.job.status === "failed" || data.job.status === "canceled") {
            setPhase("error");
            setMessage(data.job.error ?? "Generation failed.");
            setActiveJobId(null);
            await refreshJobs();
            await refreshBalance();
          }
        })
        .catch(() => {});
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId]);

  async function onGenerate() {
    if (!selectedModel || !prompt.trim()) return;
    setPhase("generating");
    setMessage(null);
    setPreviewUrl(null);
    try {
      const input: Record<string, unknown> = { prompt: prompt.trim() };
      if (selectedModel.inputSchema.aspect_ratio) {
        input.aspect_ratio = aspectRatio;
      }

      const result = await readJson<{
        jobId: string;
        status: string;
        outputUrls: string[];
        error: string | null;
        finalCostCents: number | null;
      }>("/api/v1/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          model: selectedModel.id,
          input,
          idempotencyKey: newIdempotencyKey(),
        }),
      });

      if (result.status === "succeeded" && result.outputUrls.length > 0) {
        setPhase("success");
        setPreviewUrl(result.outputUrls[0] ?? null);
        setMessage(`Generation complete. Charged ${money(result.finalCostCents ?? 0)}.`);
        await refreshJobs();
        await refreshBalance();
        return;
      }

      if (result.status === "failed") {
        throw new Error(result.error ?? "Generation failed.");
      }

      setActiveJobId(result.jobId);
      setMessage("Generating…");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Generation failed.");
      setActiveJobId(null);
      await refreshBalance();
    }
  }

  if (!enabled) {
    return (
      <EmptyState
        eyebrow="AI Create"
        title="Not enabled on this host"
        body="Set REPLICATE_API_TOKEN and AI_CREATE_ENABLED=true on the server to activate this desk."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {(["image", "video", "audio"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              disabled={tab === "audio"}
              onClick={() => setCategory(tab)}
              className={`border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] ${
                category === tab
                  ? "border-accent text-accent"
                  : "border-white/10 text-zinc-500 disabled:opacity-40"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="border border-white/10 bg-raised/40 px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Choose model</p>
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            className="mt-3 w-full border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id} className="bg-background text-zinc-100">
                {model.displayName} · up to {money(model.maxCostCents)}
              </option>
            ))}
          </select>
        </div>

        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={
              category === "video"
                ? "A drone shot over neon city streets at night, rain on the lens…"
                : "A futuristic city at night, neon reflections on wet streets…"
            }
            className="w-full border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
          />
        </label>

        {selectedModel?.inputSchema.aspect_ratio?.enum ? (
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">Aspect ratio</span>
            <select
              value={aspectRatio}
              onChange={(event) => setAspectRatio(event.target.value)}
              className="w-full border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
            >
              {selectedModel.inputSchema.aspect_ratio.enum.map((value) => (
                <option key={value} value={value} className="bg-background">
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <dl className="grid grid-cols-2 divide-x divide-white/8 border border-white/10">
          <div className="px-4 py-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Estimated cost</dt>
            <dd className="mt-2 font-mono text-xl text-accent">
              {selectedModel ? money(selectedModel.maxCostCents) : "—"}
            </dd>
          </div>
          <div className="px-4 py-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">AI credit balance</dt>
            <dd className="mt-2 font-mono text-xl text-zinc-100">{money(displayCents)}</dd>
            <p className="mt-1 font-mono text-[10px] text-zinc-500">
              Available to spend now: {money(spendableCents)}
            </p>
          </div>
        </dl>

        {spendableCents < (selectedModel?.maxCostCents ?? 100) ? (
          <div className="border border-white/10 bg-raised/40 px-4 py-4 text-sm leading-relaxed text-zinc-400">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Get Create credits
            </p>
            <p className="mt-2">
              Create credits are separate from LLM chat/API keys. Fund this balance, then generate on
              Replicate — nothing here touches Vercel AI Gateway.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-zinc-300">
              <li>
                Earn volume reward:{" "}
                <Link href="/app/swap" className="underline hover:text-accent">
                  Swap
                </Link>{" "}
                then{" "}
                <Link href="/app/claims" className="underline hover:text-accent">
                  claim
                </Link>{" "}
                qualifying fills ($250+ floor).
              </li>
              <li>
                On{" "}
                <Link href="/app/redeem" className="underline hover:text-accent">
                  Redeem
                </Link>
                , choose <span className="font-mono text-zinc-200">Create credits</span> (or Convert
                on the Desk).
              </li>
              <li>
                Or{" "}
                <Link href="/app/deposit" className="underline hover:text-accent">
                  Deposit $ACCR
                </Link>{" "}
                for a Create credit bonus.
              </li>
            </ol>
            <p className="mt-3 text-xs text-zinc-500">
              Need chat or acc_ API? Redeem{" "}
              <span className="font-mono text-zinc-300">LLM credits</span> on the Redeem page instead.
            </p>
          </div>
        ) : null}

        <NotchedButton
          type="button"
          disabled={
            phase === "generating" ||
            Boolean(activeJobId) ||
            !selectedModel ||
            !prompt.trim() ||
            spendableCents < (selectedModel?.maxCostCents ?? 100)
          }
          onClick={() => void onGenerate()}
        >
          {phase === "generating" || activeJobId ? "Generating…" : "Generate"}
        </NotchedButton>

        {message ? (
          <p
            role={phase === "error" ? "alert" : "status"}
            className={`text-sm ${phase === "error" ? "text-accent" : "text-zinc-400"}`}
          >
            {message}
          </p>
        ) : null}
      </section>

      <section className="space-y-6">
        <div className="border border-white/10 bg-raised/40 px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Output</p>
          {previewUrl ? (
            category === "video" || /\.(mp4|webm)(\?|$)/i.test(previewUrl) ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={previewUrl}
                controls
                playsInline
                className="mt-4 w-full border border-white/10"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Generated output"
                className="mt-4 w-full border border-white/10 object-cover"
              />
            )
          ) : (
            <p className="mt-4 text-sm text-zinc-500">
              {category === "video"
                ? "Your generated video will appear here."
                : "Your generated image will appear here."}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Recent generations</p>
          {jobs.length === 0 ? (
            <p className="text-sm text-zinc-500">No generations yet.</p>
          ) : (
            <ul className="divide-y divide-white/8 border border-white/10">
              {jobs.map((job) => (
                <li key={job.id} className="px-4 py-3 text-sm">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      const url = job.outputUrls[0];
                      if (url) {
                        setPreviewUrl(url);
                        setCategory(job.category === "video" ? "video" : "image");
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-200">{job.modelName}</span>
                      <span className="font-mono text-xs uppercase text-zinc-500">{job.status}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-zinc-500">{String(job.input.prompt ?? "")}</p>
                    <p className="mt-2 font-mono text-xs text-zinc-400">
                      {job.finalCostCents != null ? money(job.finalCostCents) : money(job.estimatedCostCents)} ·{" "}
                      {job.category}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
