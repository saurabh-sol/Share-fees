"use client";

import { ErrorScreen } from "@/components/error/ErrorScreen";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-[100dvh] bg-[#141416] text-[#e4e4e7]">
        <ErrorScreen
          code="500"
          title="Desk failed."
          body="The shell could not render. Nothing was recorded against your balances. Retry when the connection is back."
          retryLabel="Try again"
          onRetry={retry}
        />
      </body>
    </html>
  );
}
