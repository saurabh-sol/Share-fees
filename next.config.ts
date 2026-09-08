import type { NextConfig } from "next";

const GATEWAY_CORS_HEADERS = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
  {
    key: "Access-Control-Allow-Headers",
    value:
      "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta",
  },
];

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  serverExternalPackages: ["postgres"],
  turbopack: {
    root: process.cwd(),
  },
  transpilePackages: ["@lifi/sdk", "@lifi/sdk-provider-ethereum"],
  async rewrites() {
    return [
      { source: "/chat/completions", destination: "/api/v1/chat/completions" },
      { source: "/v1/:path*", destination: "/api/v1/:path*" },
      { source: "/v1beta/:path*", destination: "/api/v1beta/:path*" },
      { source: "/gateway/v1/:path*", destination: "/api/gateway/v1/:path*" },
    ];
  },
  async headers() {
    return [
      {
        source: "/gateway/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/api/gateway/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/v1/messages",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/api/v1/messages",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/chat/completions",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/v1/chat/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/v1/models",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/v1/models/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/api/v1/chat/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/api/v1/models",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      {
        source: "/api/v1/models/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, api-key, x-api-key, x-goog-api-key, anthropic-version, anthropic-beta" },
        ],
      },
      { source: "/v1beta/:path*", headers: GATEWAY_CORS_HEADERS },
      { source: "/api/v1beta/:path*", headers: GATEWAY_CORS_HEADERS },
      {
        source: "/og-preview.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, immutable" },
          { key: "Content-Type", value: "image/png" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https: wss:",
              "font-src 'self' data:",
              "frame-src 'self' https://auth.privy.io https://*.privy.io https://challenges.cloudflare.com https://verify.walletconnect.com https://verify.walletconnect.org https://secure.walletconnect.com https://secure.walletconnect.org",
              "child-src 'self' https://auth.privy.io https://*.privy.io https://challenges.cloudflare.com blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
