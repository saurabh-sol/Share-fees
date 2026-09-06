"use client";

import { ErrorScreen } from "@/components/error/ErrorScreen";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-[100dvh] bg-[#141416] text-[#e4e4e7]">
        <ErrorScreen
          code="404"
          title="Desk failed."
          body="The shell could not render. Same pixel 404. Retry when the connection is back."
          retryLabel="Try again"
          onRetry={reset}
        />
      </body>
    </html>
  );
}
