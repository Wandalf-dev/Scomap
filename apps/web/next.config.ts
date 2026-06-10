import type { NextConfig } from "next";

// CSP volontairement minimale : pas de script-src/style-src (Next injecte des
// scripts/styles inline ; les durcir exige des nonces). frame-ancestors,
// object-src et base-uri couvrent clickjacking et injections de base sans
// risque de casse (MapLibre, tuiles externes).
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Ignoré par les navigateurs en HTTP — sans effet sur le dev local
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@scomap/db"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
