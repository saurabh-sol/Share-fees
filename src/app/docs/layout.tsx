import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs/DocsShell";

export const metadata: Metadata = {
  title: "Docs — Trade2Credits",
  description:
    "How Trade2Credits pays: connect a wallet, clear the $250 floor, convert at 50 bps, then take USDG or a t2c_ key.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
