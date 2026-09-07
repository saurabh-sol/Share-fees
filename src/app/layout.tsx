import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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

async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141416",
};

export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteUrl();
  const image = `${origin}/og-preview.png`;
  return {
    metadataBase: new URL(origin),
    title: "Trade2Credits — Swap, then take USDG or LLM credits",
    description:
      "Connect MetaMask, Phantom, or Coinbase. Qualifying $250+ swaps convert at a published ratio into USDG or LLM credits.",
    openGraph: {
      title: "Trade2Credits",
      description: "Cross-chain swaps that pay USDG or LLM credits above a $250 floor.",
      url: origin,
      siteName: "Trade2Credits",
      type: "website",
      images: [
        {
          url: image,
          secureUrl: image,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: "Trade2Credits — You swap. We credit.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Trade2Credits",
      description: "Cross-chain swaps that pay USDG or LLM credits above a $250 floor.",
      images: [image],
    },
  };
}

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
