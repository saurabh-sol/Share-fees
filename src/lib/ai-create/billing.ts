import type { ReplicatePrediction } from "@/lib/replicate/client";
import { mapReplicateStatus } from "@/lib/replicate/client";

type BillingJob = {
  reservedCreditCents: number;
  estimatedCostCents: number;
};

function metricNumber(metrics: Record<string, unknown> | undefined, key: string) {
  const value = metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function computeFinalCostCents(job: BillingJob, prediction: ReplicatePrediction) {
  const status = mapReplicateStatus(prediction.status);
  if (status === "failed") {
    return 0;
  }

  if (status === "canceled") {
    const predictTime = metricNumber(prediction.metrics, "predict_time");
    if (predictTime == null || predictTime <= 0) {
      return 0;
    }
    const ratio = Math.min(predictTime / 60, 1);
    const partial = Math.max(1, Math.ceil(job.estimatedCostCents * ratio));
    return Math.min(job.reservedCreditCents, partial);
  }

  return job.estimatedCostCents;
}
