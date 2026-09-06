"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/error/ErrorScreen";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      title="Desk failed."
      body={
        error.digest
          ? `A request did not complete. Nothing was recorded against your balances. Reference ${error.digest}. Try again — the retry re-fetches the page.`
          : "A request did not complete. Nothing was recorded against your balances. Try again — the retry re-fetches the page."
      }
      retryLabel="Try again"
      onRetry={retry}
    />
  );
}
