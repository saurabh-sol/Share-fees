"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeSlash } from "@phosphor-icons/react";

function maskKey(value: string) {
  if (value.length <= 12) return "•".repeat(Math.max(value.length, 8));
  return `${value.slice(0, 12)}${"•".repeat(12)}`;
}

type SecretKeyFieldProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  id?: string;
  inputClassName?: string;
};

/** Editable API key input — hidden by default, eye to reveal, copy when value is set. */
export function SecretKeyField({
  value,
  onChange,
  placeholder = "acc_…",
  readOnly = false,
  id,
  inputClassName = "min-w-0 flex-1 border border-white/10 bg-transparent px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-accent",
}: SecretKeyFieldProps) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const trimmed = value.trim();
    if (!trimmed) return;
    await navigator.clipboard.writeText(trimmed);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="flex gap-2">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={readOnly ? undefined : (event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => setShow((current) => !current)}
        className="inline-flex size-10 shrink-0 items-center justify-center border border-white/10 text-zinc-400 hover:text-zinc-200"
        aria-label={show ? "Hide API key" : "Show API key"}
      >
        {show ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
      <button
        type="button"
        onClick={() => void onCopy()}
        disabled={!value.trim()}
        className="inline-flex size-10 shrink-0 items-center justify-center border border-white/10 text-zinc-400 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Copy API key"
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
    </div>
  );
}

type SecretKeyDisplayProps = {
  value: string;
  className?: string;
  /** When true, the full key is visible immediately (e.g. right after mint). */
  defaultRevealed?: boolean;
};

/** Read-only key line — masked by default with eye + copy. */
export function SecretKeyDisplay({
  value,
  className = "",
  defaultRevealed = false,
}: SecretKeyDisplayProps) {
  const [show, setShow] = useState(defaultRevealed);
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <code className="break-all font-mono text-sm text-zinc-100">
        {show ? value : maskKey(value)}
      </code>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100"
          aria-label={show ? "Hide API key" : "Show API key"}
        >
          {show ? <EyeSlash size={16} /> : <Eye size={16} />}
          {show ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="inline-flex items-center gap-2 border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy key"}
        </button>
      </div>
    </div>
  );
}

export { maskKey };
