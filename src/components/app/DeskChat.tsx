"use client";

import { useEffect, useRef, useState } from "react";
import { SidebarSimple } from "@phosphor-icons/react";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  findModel,
  type LlmProvider,
} from "@/lib/gateway/catalog";
import {
  emptyThread,
  loadDeskThreads,
  saveDeskThreads,
  titleFromPrompt,
  upsertDeskThread,
  type DeskChatTurn,
  type DeskThread,
} from "@/lib/chat/desk-threads";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatMarkdown } from "./chat/ChatMarkdown";
import { ChatMessage } from "./chat/ChatMessage";
import { ChatSidebar } from "./chat/ChatSidebar";
import { ChatModelSelect } from "./ChatModelSelect";
import { PixelChatWell } from "./PixelChatWell";

type DeskChatStatus = {
  creditCents: number;
  llmCents: number;
  spendableCents: number;
  anyProviderReady: boolean;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json()) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "request_failed");
  }
  return data;
}

export function DeskChat({
  creditCents,
  llmCents,
}: {
  creditCents: number;
  llmCents: number;
}) {
  const [provider, setProvider] = useState<LlmProvider>(DEFAULT_LLM_PROVIDER);
  const [model, setModel] = useState(DEFAULT_LLM_MODEL);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<DeskChatTurn[]>([]);
  const [threads, setThreads] = useState<DeskThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [balances, setBalances] = useState({ creditCents, llmCents });
  const [ready, setReady] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const spendable = balances.creditCents + balances.llmCents;
  const modelLabel = findModel(provider, model)?.label ?? model;

  useEffect(() => {
    setThreads(loadDeskThreads());
  }, []);

  useEffect(() => {
    void readJson<DeskChatStatus>("/api/v1/desk-chat")
      .then((data) => {
        setBalances({ creditCents: data.creditCents, llmCents: data.llmCents });
        setReady(data.anyProviderReady);
        if (!data.anyProviderReady) {
          setMessage("Upstream models are off. Chat cannot run until Gateway is configured.");
        }
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Could not load chat.");
      });
  }, []);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [turns, status]);

  function persist(next: DeskThread) {
    setThreads((list) => {
      const updated = upsertDeskThread(list, next);
      saveDeskThreads(updated);
      return updated;
    });
  }

  function onNewChat() {
    setActiveId(null);
    setTurns([]);
    setDraft("");
    setMessage(null);
    setStatus("idle");
    setSidebarOpen(false);
  }

  function onSelect(id: string) {
    const thread = threads.find((item) => item.id === id);
    if (!thread) return;
    setActiveId(thread.id);
    setTurns(thread.turns);
    setProvider(thread.provider);
    setModel(thread.model);
    setDraft("");
    setMessage(null);
    setStatus("idle");
    setSidebarOpen(false);
  }

  function onDelete(id: string) {
    const next = threads.filter((item) => item.id !== id);
    setThreads(next);
    saveDeskThreads(next);
    if (activeId === id) onNewChat();
  }

  async function onSend() {
    const text = draft.trim();
    if (!text || status === "working") return;
    if (spendable < 1) {
      setStatus("error");
      setMessage("No credit to spend. Claim a fill first.");
      return;
    }
    const userTurn: DeskChatTurn = { id: `u_${crypto.randomUUID()}`, role: "user", content: text };
    const history = [...turns, userTurn];
    const threadId = activeId ?? `cht_${crypto.randomUUID()}`;
    const draftThread: DeskThread = {
      id: threadId,
      title: titleFromPrompt(history.find((item) => item.role === "user")?.content ?? text),
      provider,
      model,
      turns: history,
      updatedAt: new Date().toISOString(),
    };
    setActiveId(threadId);
    setTurns(history);
    persist(draftThread);
    setDraft("");
    setStatus("working");
    setMessage(null);
    try {
      const result = await readJson<{
        text: string;
        spentCents: number;
        creditCents: number;
        llmCents: number;
      }>("/api/v1/desk-chat", {
        method: "POST",
        body: JSON.stringify({
          provider,
          model,
          messages: history.map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      const assistant: DeskChatTurn = {
        id: `a_${crypto.randomUUID()}`,
        role: "assistant",
        content: result.text,
      };
      const complete: DeskThread = {
        ...draftThread,
        turns: [...history, assistant],
        updatedAt: new Date().toISOString(),
      };
      setTurns(complete.turns);
      persist(complete);
      setBalances({ creditCents: result.creditCents, llmCents: result.llmCents });
      setStatus("idle");
      setMessage(`Spent ${money(result.spentCents)}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Chat failed.");
    }
  }

  return (
    <div className="desk-glass-canvas flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      <ChatSidebar
        threads={threads}
        activeId={activeId}
        availableLabel={money(spendable)}
        open={sidebarOpen}
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
        onToggle={() => setSidebarOpen((value) => !value)}
      />

      <div className="desk-glass-raised flex min-w-0 flex-1 flex-col">
        <div className="desk-glass flex items-center justify-between gap-4 border-b border-white/8 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="text-zinc-500 md:hidden"
              aria-label="Open sessions"
            >
              <SidebarSimple size={18} />
            </button>
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">LLM rail</p>
              <p className="mt-1 truncate text-sm text-zinc-100">{modelLabel}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Available</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-zinc-100">{money(spendable)}</p>
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-8">
          {turns.length === 0 ? (
            <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-8">
              <div className="max-w-[52ch] space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#c23a3a]">Room</p>
                <p className="text-3xl tracking-tight text-zinc-100">Pick a model. Send a turn.</p>
                <p className="text-sm leading-relaxed text-zinc-500">
                  Sessions stay in this browser. Token cost comes off this wallet. Website credit
                  converts 1:1 if the LLM rail is empty.
                </p>
              </div>
              <PixelChatWell talking={status === "working"} />
            </div>
          ) : (
            <ul className="mx-auto flex w-full max-w-3xl flex-col gap-5">
              {turns.map((turn) => {
                const you = turn.role === "user";
                return (
                  <ChatMessage key={turn.id} align={you ? "end" : "start"} label={you ? "You" : modelLabel}>
                    {you ? (
                      <p className="whitespace-pre-wrap">{turn.content}</p>
                    ) : (
                      <ChatMarkdown text={turn.content} />
                    )}
                  </ChatMessage>
                );
              })}
              {status === "working" ? (
                <ChatMessage align="start" label={modelLabel} accent>
                  <p className="text-sm text-zinc-500">Working</p>
                </ChatMessage>
              ) : null}
            </ul>
          )}
        </div>

        <div className="px-4 pb-6 pt-2 md:px-8">
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSubmit={() => void onSend()}
            placeholder={spendable < 1 ? "Need credit first" : "Message the desk"}
            disabled={status === "working" || !ready || spendable < 1}
            disabledReason={status === "error" ? message : null}
            working={status === "working"}
            footerStart={
              <ChatModelSelect
                provider={provider}
                model={model}
                onChange={(next) => {
                  setProvider(next.provider);
                  setModel(next.model);
                }}
              />
            }
          />
          {message && status !== "error" ? (
            <p className="mx-auto mt-3 max-w-3xl text-sm text-zinc-500" role="status">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
