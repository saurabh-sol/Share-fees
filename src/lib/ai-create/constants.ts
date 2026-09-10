export const AI_CREATE_HOLD_ACCOUNT = "ai_create_hold";

export const ACTIVE_JOB_STATUSES = ["pending", "processing"] as const;

export const TERMINAL_JOB_STATUSES = ["succeeded", "failed", "canceled"] as const;

export type AiJobStatus =
  | (typeof ACTIVE_JOB_STATUSES)[number]
  | (typeof TERMINAL_JOB_STATUSES)[number]
  | "pending";
