import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NetworkGuard } from "@/components/error/NetworkGuard";
import {
  BRAND_DESCRIPTION,
  BRAND_LOGO_PATH,
  BRAND_NAME,
  BRAND_TITLE,
} from "@/lib/brand";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  process.env.APP_ORIGIN?.replace(/\/$/, "") ??
  "https://trade2credits.onrender.com";
const OG_IMAGE = `${SITE}/og-preview.png`;
const OG_DESCRIPTION =
  "Qualifying $250+ fills convert at 50 bps. Take USDG to your wallet or LLM credits for Claude, OpenAI, DeepSeek, Google, and Grok.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141416",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: BRAND_TITLE,
    template: `%s — ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  icons: {
    icon: [{ url: BRAND_LOGO_PATH, type: "image/png" }],
    apple: [{ url: BRAND_LOGO_PATH, type: "image/png" }],
  },
  alternates: {
    canonical: SITE,
  },
  openGraph: {
    title: BRAND_TITLE,
    description: OG_DESCRIPTION,
    url: SITE,
    siteName: BRAND_NAME,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: OG_IMAGE,
        secureUrl: OG_IMAGE,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: BRAND_TITLE,
      },
      {
        url: BRAND_LOGO_PATH,
        width: 512,
        height: 512,
        type: "image/png",
        alt: `${BRAND_NAME} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_TITLE,
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
