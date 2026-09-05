import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Trade2Credits — Swap, then take USDT or LLM credits",
  description:
    "Connect MetaMask, Phantom, or Coinbase. Qualifying $500+ swaps convert at a published ratio into USDT or LLM credits.",
  openGraph: {
    title: "Trade2Credits",
    description: "Cross-chain swaps that pay USDT or LLM credits above a $500 floor.",
    url: siteUrl,
    siteName: "Trade2Credits",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trade2Credits",
    description: "Cross-chain swaps that pay USDT or LLM credits above a $500 floor.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#141416] font-sans text-zinc-200">{children}</body>
    </html>
  );
}
