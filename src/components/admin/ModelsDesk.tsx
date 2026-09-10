"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiModelAdmin } from "@/lib/ai-create/models";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const DEFAULT_SCHEMA = `{
  "prompt": {
    "type": "string",
    "required": true,
    "maxLength": 2000
  }
}`;

export function ModelsDesk({ models }: { models: AiModelAdmin[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [id, setId] = useState("");
  const [category, setCategory] = useState<"image" | "video" | "audio">("image");
  const [modelSlug, setModelSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [maxCostUsd, setMaxCostUsd] = useState("0.10");
  const [asyncRequired, setAsyncRequired] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [inputSchemaJson, setInputSchemaJson] = useState(DEFAULT_SCHEMA);

  function loadModel(model: AiModelAdmin) {
    setId(model.id);
    setCategory(model.category as "image" | "video" | "audio");
    setModelSlug(model.modelSlug);
    setDisplayName(model.displayName);
    setMaxCostUsd((model.maxCostCents / 100).toFixed(2));
    setAsyncRequired(model.asyncRequired);
    setEnabled(model.enabled);
    setSortOrder(String(model.sortOrder));
    setInputSchemaJson(JSON.stringify(model.inputSchema, null, 2));
    setMessage(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("working");
    setMessage(null);
    try {
      const inputSchema = JSON.parse(inputSchemaJson) as Record<string, unknown>;
      const response = await fetch("/api/v1/admin/ai-models", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          category,
          modelSlug,
          displayName,
          enabled,
          asyncRequired,
          sortOrder: Number(sortOrder),
          maxCostCents: Math.round(Number(maxCostUsd) * 100),
          inputSchema,
        }),
      });
      const data = (await response.json()) as { message?: string; created?: boolean };
      if (!response.ok) throw new Error(data.message ?? "Model write failed.");
      router.refresh();
      setStatus("idle");
      setMessage(data.created ? `Created ${id}.` : `Updated ${id}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Model write failed.");
    }
  }

  async function toggleModel(model: AiModelAdmin) {
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/ai-models/${model.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !model.enabled }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Toggle failed.");
      router.refresh();
      setStatus("idle");
      setMessage(`${model.id} is now ${model.enabled ? "disabled" : "enabled"}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Toggle failed.");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
        <p className="text-sm text-zinc-400">
          Upsert by model id. Disabled models disappear from the user catalog but keep history.
        </p>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Model id</span>
          <input
            required
            value={id}
            onChange={(event) => setId(event.target.value.toLowerCase())}
            placeholder="flux-schnell"
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Replicate slug</span>
          <input
            required
            value={modelSlug}
            onChange={(event) => setModelSlug(event.target.value)}
            placeholder="owner/model"
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Display name</span>
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as "image" | "video" | "audio")}
              className="w-full border border-white/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="image">image</option>
              <option value="video">video</option>
              <option value="audio">audio</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm text-zinc-400">Max cost (USD)</span>
            <input
              required
              value={maxCostUsd}
              onChange={(event) => setMaxCostUsd(event.target.value)}
              className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-zinc-300">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            Enabled
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={asyncRequired}
              onChange={(event) => setAsyncRequired(event.target.checked)}
            />
            Async required
          </label>
        </div>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Sort order</span>
          <input
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Input schema (JSON)</span>
          <textarea
            required
            rows={8}
            value={inputSchemaJson}
            onChange={(event) => setInputSchemaJson(event.target.value)}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={status === "working"}
          className="border border-accent px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-accent disabled:opacity-50"
        >
          {status === "working" ? "Saving…" : "Save model"}
        </button>
        {message ? (
          <p role={status === "error" ? "alert" : "status"} className="text-sm text-zinc-400">
            {message}
          </p>
        ) : null}
      </form>

      <ul className="divide-y divide-white/8 border border-white/10">
        {models.map((model) => (
          <li key={model.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-zinc-100">{model.displayName}</p>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  {model.id} · {model.category} · {model.modelSlug}
                </p>
                <p className="mt-2 font-mono text-xs text-zinc-400">
                  up to {money(model.maxCostCents)} · {model.asyncRequired ? "async" : "sync"} · sort{" "}
                  {model.sortOrder}
                </p>
              </div>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                  model.enabled ? "text-accent" : "text-zinc-500"
                }`}
              >
                {model.enabled ? "on" : "off"}
              </span>
            </div>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => loadModel(model)}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void toggleModel(model)}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 underline"
              >
                {model.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
