"use client";

import { Plus, SidebarSimple, Trash } from "@phosphor-icons/react";
import type { DeskThread } from "@/lib/chat/desk-threads";

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ChatSidebar({
  threads,
  activeId,
  availableLabel,
  open,
  onNewChat,
  onSelect,
  onDelete,
  onToggle,
}: {
  threads: DeskThread[];
  activeId: string | null;
  availableLabel: string;
  open: boolean;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: () => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-[#141416]/40 backdrop-blur-sm md:hidden ${open ? "" : "hidden"}`}
        onClick={onToggle}
      />
      <aside
        className={`desk-glass fixed inset-y-0 left-0 z-30 flex w-[17.5rem] shrink-0 flex-col border-r border-white/8 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Sessions</p>
          <button
            type="button"
            onClick={onToggle}
            className="text-zinc-500 md:hidden"
            aria-label="Close sessions"
          >
            <SidebarSimple size={18} />
          </button>
        </div>
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={onNewChat}
            className="desk-glass-raised flex w-full items-center gap-2 border border-white/10 px-3 py-2.5 text-left text-sm text-zinc-100 transition-transform active:scale-[0.98]"
          >
            <Plus size={16} />
            New session
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {threads.length === 0 ? (
            <p className="px-3 py-6 text-sm text-zinc-500">No saved turns yet.</p>
          ) : (
            <ul>
              {threads.map((thread) => {
                const active = thread.id === activeId;
                return (
                  <li key={thread.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => onSelect(thread.id)}
                      className={`min-w-0 flex-1 px-3 py-3 text-left ${
                        active ? "bg-white/[0.04] text-zinc-100" : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                      }`}
                    >
                      <span className="block truncate text-sm">{thread.title}</span>
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                        {formatHistoryTime(thread.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${thread.title}`}
                      onClick={() => onDelete(thread.id)}
                      className="px-2 text-zinc-600 hover:text-[#c23a3a]"
                    >
                      <Trash size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        <div className="border-t border-white/8 px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Available</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-zinc-100">{availableLabel}</p>
        </div>
      </aside>
    </>
  );
}
