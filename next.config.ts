import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only route indicator ("N" badge, bottom-left by default) — hidden
  // because it collided with the Sidebar's own "Đăng xuất" button in that
  // same corner (user request 2026-08-19). Compile/runtime error overlays
  // still show; this only suppresses the route-context badge.
  devIndicators: false,

  // Baseline hardening headers (security review 2026-08-20) applied to every
  // route — clickjacking/MIME-sniffing/referrer-leak protection cheap enough
  // for an internal tool. No Content-Security-Policy here: a correct CSP for
  // this app needs nonce wiring through every inline script Next.js emits,
  // which is a dedicated piece of work, not something to bolt on unverified.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
