"use client";

import { useEffect, useState } from "react";
import { CaretDown, Check, Copy, Eye, EyeSlash } from "@phosphor-icons/react";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  LLM_CATALOG,
  modelsForProvider,
  type LlmProvider,
} from "@/lib/gateway/catalog";
import { clientSnippets } from "@/lib/gateway/client-snippets";
import {
  buildTryRequest,
  DEFAULT_TRY_MESSAGE,
  extractTryReply,
  humanizeTryError,
  moneyFromCents,
  readTryResultHeaders,
} from "@/lib/gateway/try-request";
import { ProviderMark } from "@/components/llm/ProviderMark";
import { isVirtualKey } from "@/lib/brand";
import { NotchedButton } from "@/components/ui/NotchedButton";

export type ApiKeyTryPanelProps = {
  gatewayBaseUrl: string;
  initialProvider?: LlmProvider;
  initialModel?: string;
  initialApiKey?: string;
  lockProviderModel?: boolean;
  title?: string;
  onSuccess?: () => void;
};

export function ApiKeyTryPanel({
  gatewayBaseUrl,
  initialProvider = DEFAULT_LLM_PROVIDER,
  initialModel = DEFAULT_LLM_MODEL,
  initialApiKey = "",
  lockProviderModel = false,
  title = "Test your API",
  onSuccess,
}: ApiKeyTryPanelProps) {
  const [provider, setProvider] = useState<LlmProvider>(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [message, setMessage] = useState(DEFAULT_TRY_MESSAGE);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [showKey, setShowKey] = useState(false);
  const [running, setRunning] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [remainingLabel, setRemainingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  useEffect(() => {
    setProvider(initialProvider);
    setModel(initialModel);
  }, [initialProvider, initialModel]);

  useEffect(() => {
    if (initialApiKey) setApiKey(initialApiKey);
  }, [initialApiKey]);

  useEffect(() => {
    const models = modelsForProvider(provider);
    if (!models.some((item) => item.id === model)) {
      setModel(models[0]?.id ?? DEFAULT_LLM_MODEL);
    }
  }, [provider, model]);

  const snippet = clientSnippets(provider, gatewayBaseUrl, apiKey.trim() || "acc_…", model, message);
  const providerLabel = LLM_CATALOG.find((item) => item.id === provider)?.label ?? provider;
  const modelLabel =
    modelsForProvider(provider).find((item) => item.id === model)?.label ?? model;

  async function onRun() {
    const key = apiKey.trim();
    if (!key) {
      setError("Paste your acc_ key first.");
      setReply(null);
      setRawJson(null);
      return;
    }
    if (!isVirtualKey(key)) {
      setError("This does not look like an acc_ key.");
      setReply(null);
      setRawJson(null);
      return;
    }

    setRunning(true);
    setError(null);
    setReply(null);
    setRemainingLabel(null);
    setRawJson(null);

    try {
      const req = buildTryRequest({
        provider,
        model,
        gatewayBaseUrl,
        apiKey: key,
        message,
      });
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(req.body),
      });
      const json = (await response.json()) as unknown;
      setRawJson(JSON.stringify(json, null, 2));

      const headers = readTryResultHeaders(response);
      if (headers.remainingCents !== null) {
        setRemainingLabel(moneyFromCents(headers.remainingCents));
      }

      if (!response.ok) {
        setError(humanizeTryError(response.status, json, model));
        return;
      }

      setReply(extractTryReply(provider, json));
      onSuccess?.();
    } catch {
      setError("Could not reach the API. Try again.");
    } finally {
      setRunning(false);
    }
  }

  async function copyCurl() {
    await navigator.clipboard.writeText(snippet.curl);
    setCopiedCurl(true);
    window.setTimeout(() => setCopiedCurl(false), 1400);
  }

  return (
    <section className="max-w-2xl space-y-6 border-y border-white/8 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Try it</p>
        <h2 className="mt-2 text-xl tracking-tight text-zinc-100">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Type a short message, paste your key, and run a real test call. Each run uses a small amount of
          credit from that key.
        </p>
      </div>

      <div className="space-y-4">
        {!lockProviderModel ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Provider</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
                  <ProviderMark provider={provider} size={22} />
                </span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as LlmProvider)}
                  className="w-full appearance-none border border-white/10 bg-transparent py-2.5 pl-11 pr-9 font-mono text-sm text-zinc-100 outline-none focus:border-accent"
                >
                  {LLM_CATALOG.map((item) => (
                    <option key={item.id} value={item.id} className="bg-background">
                      {item.label}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
              </div>
            </label>
            <label className="block space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Model</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
                  <ProviderMark provider={provider} size={22} />
                </span>
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="w-full appearance-none border border-white/10 bg-transparent py-2.5 pl-11 pr-9 font-mono text-sm text-zinc-100 outline-none focus:border-accent"
                >
                  {modelsForProvider(provider).map((item) => (
                    <option key={item.id} value={item.id} className="bg-background">
                      {item.label}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
              </div>
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 border border-white/10 px-3 py-2.5">
            <ProviderMark provider={provider} size={22} />
            <p className="font-mono text-xs text-zinc-400">
              Locked to {providerLabel} · {modelLabel}
            </p>
          </div>
        )}

        <label className="block space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Your message</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="w-full resize-y border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
            placeholder={DEFAULT_TRY_MESSAGE}
          />
        </label>

        <label className="block space-y-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">API key</span>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="acc_…"
              className="min-w-0 flex-1 border border-white/10 bg-transparent px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="inline-flex size-10 shrink-0 items-center justify-center border border-white/10 text-zinc-400 hover:text-zinc-200"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <NotchedButton type="button" disabled={running} onClick={() => void onRun()}>
          {running ? "Running…" : "Run test"}
        </NotchedButton>
      </div>

      {error ? (
        <div role="alert" className="border border-accent/40 px-4 py-3 text-sm text-zinc-200">
          {error}
        </div>
      ) : null}

      {reply ? (
        <div className="space-y-3 border border-white/10 bg-raised/30 px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Reply</p>
          <p className="text-sm leading-relaxed text-zinc-100">{reply}</p>
          {remainingLabel ? (
            <p className="font-mono text-xs text-accent">Credit left on this key: {remainingLabel}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-300"
        >
          {advancedOpen ? "Hide" : "Show"} curl command and raw response
        </button>
        {advancedOpen ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Curl</p>
                <button
                  type="button"
                  onClick={() => void copyCurl()}
                  className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-100"
                >
                  {copiedCurl ? <Check size={12} /> : <Copy size={12} />}
                  {copiedCurl ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-zinc-300">
                {snippet.curl}
              </pre>
            </div>
            {rawJson ? (
              <div className="space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Raw response</p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-zinc-400">
                  {rawJson}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
