"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUp, CircleNotch } from "@phosphor-icons/react";
import { MAX_CHAT_MESSAGE_CHARS } from "@/lib/chat/desk-threads";

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  disabledReason,
  working,
  footerStart,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled: boolean;
  disabledReason?: string | null;
  working: boolean;
  footerStart: ReactNode;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const over = value.trim().length > MAX_CHAT_MESSAGE_CHARS;
  const canSend = Boolean(value.trim()) && !disabled && !working && !over;

  useEffect(() => {
    if (disabled || working) return;
    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [disabled, working]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
      className="desk-glass mx-auto w-full max-w-3xl border border-white/10"
    >
      <label className="block">
        <span className="sr-only">Message</span>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          rows={2}
          placeholder={placeholder}
          disabled={disabled || working}
          className="max-h-[10.5rem] min-h-[4.25rem] w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-40"
        />
      </label>
      <div className="flex items-end justify-between gap-3 px-3 pb-3">
        <div className="min-w-0">{footerStart}</div>
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#c23a3a] text-zinc-50 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {working ? <CircleNotch size={16} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
      </div>
      {disabledReason ? (
        <p className="border-t border-white/8 px-4 py-2 text-sm text-[#c23a3a]" role="status">
          {disabledReason}
        </p>
      ) : over ? (
        <p className="border-t border-white/8 px-4 py-2 text-sm text-[#c23a3a]" role="status">
          Message is over {MAX_CHAT_MESSAGE_CHARS.toLocaleString()} characters.
        </p>
      ) : null}
    </form>
  );
}
