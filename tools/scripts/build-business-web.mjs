import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const apiUrl =
  process.env.BUSINESS_WEB_MEDUSA_URL || "https://descargas.eav-labs.com/agestyles-seller";
const publishableKey = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY;

if (!publishableKey?.startsWith("pk_")) {
  throw new Error("Load the lab's public publishable key before exporting the seller web app.");
}

process.env.EXPO_PUBLIC_MEDUSA_URL = apiUrl;
// The buyer mode (the shared Tienda, AG-31) uses the buyer gateway: the API origin without the
// seller prefix, unless given explicitly.
process.env.EXPO_PUBLIC_BUYER_MEDUSA_URL =
  process.env.BUSINESS_WEB_BUYER_MEDUSA_URL || new URL(apiUrl).origin;
process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY = publishableKey;
process.env.EXPO_NO_TELEMETRY = "1";

const result = spawnSync(
  "corepack",
  [
    "pnpm",
    "--filter",
    "@agestyles/business-app",
    "exec",
    "expo",
    "export",
    "--platform",
    "web",
    "--clear",
  ],
  { cwd: repoRoot, env: process.env, stdio: "inherit" },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

function readJavaScript(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? readJavaScript(entryPath)
        : entry.name.endsWith(".js")
          ? readFileSync(entryPath, "utf8")
          : "";
    })
    .join("\n");
}

const bundle = readJavaScript(path.join(repoRoot, "apps/business-app/dist"));
if (!bundle.includes(apiUrl) || !bundle.includes(publishableKey)) {
  throw new Error("The exported seller bundle is missing its configured API URL or public key.");
}
if (bundle.includes("127.0.0.1:19080") || bundle.includes("127.0.0.1:19081")) {
  throw new Error("The exported seller bundle still points to a local API address.");
}

console.log(
  `Seller web export ready at apps/business-app/dist (API: ${apiUrl}; buyer mode: ${process.env.EXPO_PUBLIC_BUYER_MEDUSA_URL})`,
);
