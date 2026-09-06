"use client";

import { useEffect, useState } from "react";
import { ErrorScreen } from "./ErrorScreen";

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!window.navigator.onLine);
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", sync);
    };
  }, []);

  if (offline) {
    return (
      <ErrorScreen
        code="404"
        title="Network gone."
        body="The desk cannot reach the network. This is the same 404 field. Reconnect, then try again."
        retryLabel="Retry"
        onRetry={() => {
          if (window.navigator.onLine) {
            setOffline(false);
            window.location.reload();
          }
        }}
      />
    );
  }

  return children;
}
