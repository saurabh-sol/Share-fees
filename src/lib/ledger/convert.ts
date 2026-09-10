import { and, eq } from "drizzle-orm";
import { isUniqueViolation } from "@/lib/db/errors";
import { getDb } from "@/lib/db/client";
import { creditConversions, ledgerEntries } from "@/lib/db/schema";
import { lockWalletRow, sumAccountCents, syncWalletCache } from "./balances";
import { assertUsdgClaimsOpen } from "@/lib/v2/upgrade";
import { ledgerAccountForRail } from "./rail-accounts";
import { assertStockRedeemOpen } from "@/lib/v2/upgrade";
import { isStockRail, LedgerError, newLedgerId, readWallet, type Rail } from "./post-swap-reward";

export type ConvertInput = {
  userId: string;
  rail: Rail;
  amountCents: number;
  idempotencyKey: string;
};

export async function convertCredits(
  input: ConvertInput,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());

  if (!Number.isInteger(input.amountCents) || input.amountCents < 1) {
    throw new LedgerError("invalid_amount");
  }

  if (input.rail === "usdt") {
    assertUsdgClaimsOpen();
  }
  if (isStockRail(input.rail)) {
    assertStockRedeemOpen();
  }

  const [existing] = await client
    .select()
    .from(creditConversions)
    .where(
      and(
        eq(creditConversions.userId, input.userId),
        eq(creditConversions.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      alreadyExists: true,
      conversionId: existing.id,
      rail: existing.rail as Rail,
      amountCents: existing.amountCents,
      ...(await readWallet(client, input.userId)),
    };
  }

  try {
    return await client.transaction(async (tx) => {
      await lockWalletRow(tx as never, input.userId);
      const replay = await tx
        .select()
        .from(creditConversions)
        .where(
          and(
            eq(creditConversions.userId, input.userId),
            eq(creditConversions.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (replay[0]) {
        return {
          alreadyExists: true,
          conversionId: replay[0].id,
          rail: replay[0].rail as Rail,
          amountCents: replay[0].amountCents,
          ...(await readWallet(tx as never, input.userId)),
        };
      }

      const available = await sumAccountCents(tx as never, input.userId, "user_credits");
      if (available < input.amountCents) {
        throw new LedgerError("insufficient_credits", 400);
      }

      const conversionId = newLedgerId("cnv");
      const dest = ledgerAccountForRail(input.rail);

      await tx.insert(creditConversions).values({
        id: conversionId,
        userId: input.userId,
        rail: input.rail,
        amountCents: input.amountCents,
        idempotencyKey: input.idempotencyKey,
      });

      await tx.insert(ledgerEntries).values([
        {
          id: newLedgerId("led"),
          userId: input.userId,
          account: "user_credits",
          type: "debit",
          amountCents: input.amountCents,
          referenceType: "conversion",
          referenceId: conversionId,
        },
        {
          id: newLedgerId("led"),
          userId: input.userId,
          account: dest,
          type: "credit",
          amountCents: input.amountCents,
          referenceType: "conversion",
          referenceId: conversionId,
        },
      ]);

      const balances = await syncWalletCache(tx as never, input.userId);
      return {
        alreadyExists: false,
        conversionId,
        rail: input.rail,
        amountCents: input.amountCents,
        ...balances,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const [row] = await client
        .select()
        .from(creditConversions)
        .where(
          and(
            eq(creditConversions.userId, input.userId),
            eq(creditConversions.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (row) {
        return {
          alreadyExists: true,
          conversionId: row.id,
          rail: row.rail as Rail,
          amountCents: row.amountCents,
          ...(await readWallet(client, input.userId)),
        };
      }
    }
    throw error;
  }
}
