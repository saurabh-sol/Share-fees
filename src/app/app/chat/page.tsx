import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DeskChat } from "@/components/app/DeskChat";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { wallets } from "@/lib/db/schema";
import { spendableLlmCents } from "@/lib/ledger/desk-chat";

export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  const [wallet, spendable] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.userId, session.user.id)).limit(1).then((rows) => rows[0]),
    spendableLlmCents(session.user.id, db),
  ]);

  return (
    <div className="-mx-4 -my-10 h-[calc(100dvh-3.5rem)] overflow-hidden md:-mx-8">
      <DeskChat
        creditCents={wallet?.creditCacheCents ?? 0}
        llmCents={spendable.spendableCents}
      />
    </div>
  );
}
