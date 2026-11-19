import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = resolve(root, ".env.buyer-web");

function parseEnv(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

let buyerEnv;
try {
  buyerEnv = parseEnv(readFileSync(envFile, "utf8"));
} catch {
  console.error("Falta el archivo privado .env.buyer-web en la raíz del monorepo.");
  process.exit(1);
}

if (!buyerEnv.BUYER_WEB_MEDUSA_URL || !buyerEnv.BUYER_WEB_MEDUSA_PUBLISHABLE_API_KEY) {
  console.error(".env.buyer-web necesita la URL del laboratorio y su clave publicable.");
  process.exit(1);
}

const result = spawnSync(
  "corepack",
  // --clear: Metro caches transforms with EXPO_PUBLIC_* inlined; another export (lab or a
  // worktree) could otherwise leave its API URL in the production bundle.
  [
    "pnpm",
    "--filter",
    "@agestyles/buyer-app",
    "exec",
    "expo",
    "export",
    "--platform",
    "web",
    "--clear",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_NO_TELEMETRY: "1",
      EXPO_PUBLIC_MEDUSA_URL: buyerEnv.BUYER_WEB_MEDUSA_URL,
      EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY: buyerEnv.BUYER_WEB_MEDUSA_PUBLISHABLE_API_KEY,
      EXPO_PUBLIC_ANDROID_APK_URL: buyerEnv.BUYER_WEB_ANDROID_APK_URL || "",
    },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
