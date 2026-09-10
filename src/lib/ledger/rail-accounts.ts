import { isStockRail, isUsdtLikeRail, type Rail } from "@/lib/redeem/rails";
import type { LedgerAccount } from "./balances";

export function isAiCreateRail(rail: Rail): boolean {
  return rail === "ai_create_credits";
}

export function isLlmChatRail(rail: Rail): boolean {
  return rail === "llm_credits";
}

export function ledgerAccountForRail(rail: Rail): LedgerAccount {
  if (isUsdtLikeRail(rail) || isStockRail(rail)) {
    return "user_usdt";
  }
  if (isAiCreateRail(rail)) {
    return "user_ai_create";
  }
  return "user_llm";
}
