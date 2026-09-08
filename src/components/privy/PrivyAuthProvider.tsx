"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
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
        <span className="font-mono">auth.privy.io</span> is reachable and your
        production domain is in the Privy dashboard allowed origins.
      </p>
    </>
  );
}

interface PrivyErrorBoundaryState {
  error: string | null;
}

class PrivyErrorBoundary extends Component<
  { children: ReactNode },
  PrivyErrorBoundaryState
> {
  state: PrivyErrorBoundaryState = { error: null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[Privy] initialization error:", err, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
          <div className="max-w-md text-center">
            <p className="text-sm text-accent">Privy failed to initialize</p>
            <p className="mt-2 font-mono text-xs text-zinc-500">
              {this.state.error}
            </p>
            <p className="mt-4 text-xs text-zinc-400">
              Verify <span className="font-mono text-zinc-200">NEXT_PUBLIC_PRIVY_APP_ID</span>{" "}
              matches a valid app ID from{" "}
              <a
                href="https://dashboard.privy.io"
                className="underline hover:text-zinc-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                dashboard.privy.io
              </a>{" "}
              and your domain is in the allowed origins.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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
  const cleanId = appId?.trim();

  if (!cleanId) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <p className="max-w-md text-center text-sm text-zinc-400">
          Privy is not configured. Set{" "}
          <span className="font-mono text-zinc-200">NEXT_PUBLIC_PRIVY_APP_ID</span>{" "}
          or <span className="font-mono text-zinc-200">PRIVY_APP_ID</span> in your environment.
        </p>
      </div>
    );
  }

  return (
    <PrivyErrorBoundary>
      <PrivyProvider
        appId={cleanId}
        {...(clientId ? { clientId: clientId.trim() } : {})}
        config={privyConfigBase}
      >
        <PrivyInitStatus>{children}</PrivyInitStatus>
      </PrivyProvider>
    </PrivyErrorBoundary>
  );
}
