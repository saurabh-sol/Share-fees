export class RedeemError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "RedeemError";
  }
}
