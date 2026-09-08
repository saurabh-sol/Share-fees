import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  isLlmProvider,
  type LlmProvider,
} from "@/lib/gateway/catalog";
import { pageTitle } from "@/lib/brand";
import { env } from "@/lib/env";
import { listVirtualKeys } from "@/lib/redeem/service";
import { TryApiKeyPicker } from "@/components/app/TryApiKeyPicker";

export const metadata: Metadata = {
  title: pageTitle("Try API"),
  description: "Paste your acc_ key, send a test message, and see the live reply plus remaining credit.",
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function TryApiPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const keys = await listVirtualKeys(session.user.id);
  const activeKeys = keys.filter((key) => key.status === "active" && key.remainingCents > 0);

  const pickerOptions = activeKeys.map((key) => ({
    id: key.id,
    label: `${key.prefix}… · ${key.provider ?? "openai"} · ${key.model ?? DEFAULT_LLM_MODEL} · ${money(key.remainingCents)} left`,
    provider: (key.provider && isLlmProvider(key.provider) ? key.provider : DEFAULT_LLM_PROVIDER) as LlmProvider,
    model: key.model ?? DEFAULT_LLM_MODEL,
  }));

  const first = pickerOptions[0];

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">LLM keys</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Try API</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Send a short test message with your acc_ key. No terminal needed — paste the key, run the test, and
          see the reply plus how much credit is left.
        </p>
      </div>

      <TryApiKeyPicker
        gatewayBaseUrl={`${env.publicAppUrl.replace(/\/$/, "")}/v1`}
        options={pickerOptions}
        initialProvider={first?.provider ?? DEFAULT_LLM_PROVIDER}
        initialModel={first?.model ?? DEFAULT_LLM_MODEL}
      />
    </div>
  );
}
