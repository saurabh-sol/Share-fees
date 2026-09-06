import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  isLlmProvider,
  type LlmProvider,
} from "@/lib/gateway/catalog";

export const DESK_THREAD_STORAGE_KEY = "t2c.desk-threads.v1";
export const MAX_DESK_THREADS = 40;
export const MAX_CHAT_MESSAGE_CHARS = 8_000;

export type DeskChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type DeskThread = {
  id: string;
  title: string;
  provider: LlmProvider;
  model: string;
  turns: DeskChatTurn[];
  updatedAt: string;
};

function isTurn(value: unknown): value is DeskChatTurn {
  if (!value || typeof value !== "object") return false;
  const row = value as DeskChatTurn;
  return (
    typeof row.id === "string" &&
    (row.role === "user" || row.role === "assistant") &&
    typeof row.content === "string"
  );
}

function isThread(value: unknown): value is DeskThread {
  if (!value || typeof value !== "object") return false;
  const row = value as DeskThread;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    isLlmProvider(row.provider) &&
    typeof row.model === "string" &&
    Array.isArray(row.turns) &&
    row.turns.every(isTurn) &&
    typeof row.updatedAt === "string"
  );
}

export function titleFromPrompt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New session";
  return clean.length > 42 ? `${clean.slice(0, 41)}…` : clean;
}

export function emptyThread(): DeskThread {
  return {
    id: `cht_${crypto.randomUUID()}`,
    title: "New session",
    provider: DEFAULT_LLM_PROVIDER,
    model: DEFAULT_LLM_MODEL,
    turns: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadDeskThreads(): DeskThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DESK_THREAD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isThread).slice(0, MAX_DESK_THREADS);
  } catch {
    return [];
  }
}

export function saveDeskThreads(threads: DeskThread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    DESK_THREAD_STORAGE_KEY,
    JSON.stringify(threads.slice(0, MAX_DESK_THREADS)),
  );
}

export function upsertDeskThread(threads: DeskThread[], next: DeskThread) {
  const without = threads.filter((item) => item.id !== next.id);
  return [next, ...without].slice(0, MAX_DESK_THREADS);
}
