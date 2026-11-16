import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")
const apiEnv = "apps/commerce-api/.env"
const composeFile = "infra/compose/mercur-lab.yaml"
const buyerEnv = resolve(root, "apps/buyer-app/.env.local")
const randomHex = () => randomBytes(32).toString("hex")

if (process.argv[2] === "api") {
  const target = resolve(root, apiEnv)
  if (!existsSync(target)) {
    const password = randomHex()
    const env = [
      `POSTGRES_PASSWORD=${password}`,
      `DATABASE_URL=postgres://agestyles_lab:${password}@127.0.0.1:15472/agestyles_mercur_lab`,
      "REDIS_URL=redis://127.0.0.1:16392",
      `JWT_SECRET=${randomHex()}`,
      `COOKIE_SECRET=${randomHex()}`,
    ]
    writeFileSync(target, env.join("\n") + "\n", { mode: 0o600, flag: "wx" })
  }
  console.log("Mercur lab environment is ready.")
} else if (process.argv[2] === "buyer") {
  const key = execFileSync("docker", [
    "compose", "--env-file", apiEnv, "-f", composeFile, "exec", "-T", "postgres",
    "psql", "-U", "agestyles_lab", "-d", "agestyles_mercur_lab", "-Atc",
    "SELECT token FROM api_key WHERE type = 'publishable' AND revoked_at IS NULL ORDER BY created_at LIMIT 1",
  ], { cwd: root, encoding: "utf8" }).trim()
  if (!/^pk_[a-z\d]+$/i.test(key)) throw new Error("Seed the lab before configuring Expo.")
  writeFileSync(buyerEnv, [
    "EXPO_PUBLIC_MEDUSA_URL=http://127.0.0.1:19080",
    `EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY=${key}`,
    "",
  ].join("\n"), { mode: 0o600 })
  console.log("Expo is configured for the Mercur lab.")
} else {
  throw new Error("Usage: node tools/scripts/mercur-lab-env.mjs api|buyer")
}
