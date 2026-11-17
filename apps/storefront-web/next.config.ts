import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(appDir, "../.."),
  transpilePackages: ["@agestyles/api-client", "@agestyles/domain", "@agestyles/icons"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
