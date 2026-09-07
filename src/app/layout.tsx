import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NetworkGuard } from "@/components/error/NetworkGuard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141416",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Trade2Credits — Swap, then take USDG or LLM credits",
  description:
    "Connect MetaMask, Phantom, or Coinbase. Qualifying $250+ swaps convert at a published ratio into USDG or LLM credits.",
  openGraph: {
    title: "Trade2Credits",
    description: "Cross-chain swaps that pay USDG or LLM credits above a $250 floor.",
    url: siteUrl,
    siteName: "Trade2Credits",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trade2Credits",
    description: "Cross-chain swaps that pay USDG or LLM credits above a $250 floor.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-clip bg-background font-sans text-zinc-200">
        <NetworkGuard>{children}</NetworkGuard>
      </body>
    </html>
  );
}
