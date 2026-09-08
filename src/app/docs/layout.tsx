import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs/DocsShell";
import { BRAND_NAME, docsPageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: docsPageTitle("Home"),
  description:
    `How ${BRAND_NAME} pays: connect a wallet, clear the $250 floor, convert at 50 bps, then take USDG or an acc_ key.`,
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
