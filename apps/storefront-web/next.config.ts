import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(appDir, "../.."),
  transpilePackages: [
    "@agestyles/api-client",
    "@agestyles/domain",
    "@agestyles/features-buyer",
    "@agestyles/icons",
  ],
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            // default-src 'self' and frame-ancestors 'none' (P1). Narrow allowances the
            // catalog already needs: Google Fonts (@import in src/app/styles.css) and
            // product photos, which Medusa serves from the deployment's backend host
            // (MEDUSA_BACKEND_URL, not pinned here) — narrow img-src to that host when
            // it is fixed. Client fetches are same-origin only (/api/*).
            value: [
              "default-src 'self'",
              "frame-ancestors 'none'",
              "style-src 'self' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self'",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
