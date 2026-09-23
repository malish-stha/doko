import type { NextConfig } from "next";

/**
 * Security headers for every response. The CSP allows what the app actually
 * uses: same-origin scripts (Next inlines a few, hence 'unsafe-inline'),
 * Google Fonts, DiceBear/Google/GitHub avatars, and websocket/https calls to
 * the Convex deployment.
 */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
const convexOrigins = convexUrl
  ? [convexUrl, convexUrl.replace(/^https:/, "wss:"), convexUrl.replace(".convex.cloud", ".convex.site")].join(" ")
  : "https://*.convex.cloud wss://*.convex.cloud https://*.convex.site";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://api.dicebear.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://secure.gravatar.com https://www.gravatar.com https://*.convex.cloud",
  `connect-src 'self' ${convexOrigins} https://accounts.google.com`,
  "media-src 'self' https://*.convex.cloud",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "secure.gravatar.com" },
      { protocol: "https", hostname: "www.gravatar.com" },
      { protocol: "https", hostname: "*.convex.cloud" },
    ],
  },
};

export default nextConfig;
