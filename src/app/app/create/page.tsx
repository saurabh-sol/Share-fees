import { redirect } from "next/navigation";
import { AiCreateDesk } from "@/components/app/AiCreateDesk";
import { getAiCreateBalance, listAiJobs } from "@/lib/ai-create/jobs";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { pageTitle } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: pageTitle("AI Create"),
  description: "Spend Accrued AI Credit on image, video, and audio generation.",
};

export default async function AiCreatePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const enabled = env.aiCreateEnabled && Boolean(env.replicateApiToken);
  let jobs: Awaited<ReturnType<typeof listAiJobs>> = [];
  let balance = { displayCents: 0, spendableCents: 0 };

  if (enabled) {
    try {
      [jobs, balance] = await Promise.all([
        listAiJobs(session.user.id),
        getAiCreateBalance(session.user.id),
      ]);
    } catch (error) {
      console.error("[ai/create] load failed", error);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Accrued desk</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">AI Create</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Image and video generation runs on Replicate using your Create credit balance only. After
          scan and claim, choose Create credits on{" "}
          <a href="/app/redeem" className="text-zinc-200 underline hover:text-accent">
            Redeem
          </a>
          , convert on the Desk, or{" "}
          <a href="/app/deposit" className="text-zinc-200 underline hover:text-accent">
            Deposit
          </a>
          . LLM chat and acc_ API keys are a separate rail (Vercel AI Gateway).
        </p>
      </div>
      <AiCreateDesk
        initialJobs={jobs}
        initialDisplayCents={balance.displayCents}
        initialSpendableCents={balance.spendableCents}
        enabled={enabled}
      />
    </div>
  );
}
