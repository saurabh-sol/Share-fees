"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { useEffect, useState, type ReactNode } from "react";
import { privyConfigBase } from "@/lib/privy/config";

function PrivyInitStatus({ children }: { children: ReactNode }) {
  const [slowInit, setSlowInit] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlowInit(true), 10_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!slowInit) return children;

  return (
    <>
      {children}
      <p className="pointer-events-none fixed bottom-4 left-1/2 z-50 max-w-md -translate-x-1/2 border border-amber-500/40 bg-background/95 px-4 py-2 text-center text-xs text-amber-200">
        Privy is taking longer than usual. Check that{" "}
        <span className="font-mono">auth.privy.io</span> is reachable and{" "}
        <span className="font-mono">http://localhost:3000</span> is allowed in your Privy dashboard.
      </p>
    </>
  );
}

export function PrivyAuthProvider({
  appId,
  clientId,
  children,
}: {
  appId: string | undefined;
  clientId?: string;
  children: ReactNode;
}) {
  if (!appId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <p className="max-w-md text-center text-sm text-zinc-400">
          Privy is not configured. Set <span className="font-mono text-zinc-200">NEXT_PUBLIC_PRIVY_APP_ID</span>{" "}
          or <span className="font-mono text-zinc-200">PRIVY_APP_ID</span> in your environment.
        </p>
      </div>
    );
  }

  return (
    <PrivyProvider appId={appId} {...(clientId ? { clientId } : {})} config={privyConfigBase}>
      <PrivyInitStatus>{children}</PrivyInitStatus>
    </PrivyProvider>
  );
}
