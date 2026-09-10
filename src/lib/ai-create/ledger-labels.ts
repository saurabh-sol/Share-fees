export function ledgerReferenceLabel(referenceType: string): string {
  switch (referenceType) {
    case "swap":
      return "Swap reward";
    case "accr_deposit":
      return "Deposit";
    case "conversion":
      return "Convert";
    case "redemption":
      return "Redeem";
    case "ai_create_settle":
      return "AI generation";
    case "ai_create_hold":
      return "AI hold";
    case "desk_chat":
      return "Chat";
    case "desk_chat_hold":
      return "Chat hold";
    case "payout_refund":
      return "Payout refund";
    default:
      return referenceType.replaceAll("_", " ");
  }
}

export function ledgerAccountLabel(account: string): string {
  switch (account) {
    case "user_credits":
      return "Website credit";
    case "user_usdt":
      return "USDG rail";
    case "user_llm":
      return "LLM rail";
    case "user_ai_create":
      return "AI Create rail";
    case "ai_create_hold":
      return "AI hold";
    case "rewards_expense":
      return "Rewards expense";
    default:
      return account;
  }
}
