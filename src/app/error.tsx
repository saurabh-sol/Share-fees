"use client";

import { ErrorScreen } from "@/components/error/ErrorScreen";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <ErrorScreen
      code="404"
      title="Desk failed."
      body="A request did not complete. Treat it as a 404 on this field. Try again when the network or database answers."
      retryLabel="Try again"
      onRetry={reset}
    />
  );
}
