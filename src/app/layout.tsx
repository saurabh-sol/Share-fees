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

const SITE = "https://trade2credits.onrender.com";
const OG_IMAGE = `${SITE}/og-preview.png`;
const OG_TITLE = "You swap. We credit.";
const OG_DESCRIPTION =
  "Qualifying $250+ fills convert at 50 bps. Take USDG to your wallet or LLM credits for Claude, OpenAI, DeepSeek, and Google.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141416",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Trade2Credits — Swap, then take USDG or LLM credits",
  description:
    "Connect MetaMask, Phantom, or Coinbase. Qualifying $250+ swaps convert at a published ratio into USDG or LLM credits.",
  alternates: {
    canonical: SITE,
  },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: SITE,
    siteName: "Trade2Credits",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        secureUrl: OG_IMAGE,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Trade2Credits — You swap. We credit.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [OG_IMAGE],
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
