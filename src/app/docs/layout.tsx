import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs/DocsShell";

export const metadata: Metadata = {
  title: "Docs — Accrued",
  description:
    "How Accrued pays: connect a wallet, clear the $250 floor, convert at 50 bps, then take USDG or a acc_ key.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
