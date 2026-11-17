import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

async function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("Commerce API runtime, gateways, healthcheck, image and runbook use one port", async () => {
  const packageJson = JSON.parse(await readRepositoryFile("apps/commerce-api/package.json"));
  const apiPortMatch = packageJson.scripts.start.match(/--port\s+(\d+)/);
  assert.ok(apiPortMatch, "Commerce API start script must declare its port");
  const apiPort = Number(apiPortMatch[1]);

  const [
    dockerfile,
    compose,
    runbook,
    buyerGateway,
    sellerGateway,
    buyerSdk,
    buyerVerifier,
    businessContext,
    businessBuyerActor,
    buyerEnv,
    businessEnv,
  ] = await Promise.all([
    readRepositoryFile("apps/commerce-api/Dockerfile.public"),
    readRepositoryFile("infra/compose/buyer-web.yaml"),
    readRepositoryFile("docs/runbooks/manual-commerce-api-publish.md"),
    readRepositoryFile("tools/scripts/buyer-lab-gateway.mjs"),
    readRepositoryFile("tools/scripts/seller-lab-gateway.mjs"),
    readRepositoryFile("apps/buyer-app/lib/sdk.ts"),
    readRepositoryFile("apps/buyer-app/scripts/verify-marketplace.mts"),
    readRepositoryFile("apps/business-app/context/business-context.tsx"),
    readRepositoryFile("apps/business-app/context/buyer-actor.ts"),
    readRepositoryFile("apps/buyer-app/.env.example"),
    readRepositoryFile("apps/business-app/.env.example"),
  ]);

  assert.match(dockerfile, new RegExp(`^EXPOSE ${apiPort}$`, "m"));
  assert.match(compose, new RegExp(`127\\.0\\.0\\.1:${apiPort}/health`));
  assert.match(runbook, new RegExp(`curl -fsS http://127\\.0\\.0\\.1:${apiPort}/health`));
  for (const [name, source] of [
    ["buyer gateway", buyerGateway],
    ["seller gateway", sellerGateway],
  ]) {
    // Gateways default to the lab API port; production overrides UPSTREAM_PORT in its compose service.
    assert.match(
      source,
      new RegExp(`UPSTREAM_PORT \\?\\? ${apiPort}\\b`),
      `${name} must default to the API port`,
    );
  }
  for (const [name, source] of [
    ["buyer SDK", buyerSdk],
    ["buyer integration verifier", buyerVerifier],
    ["business member SDK", businessContext],
    ["business buyer SDK", businessBuyerActor],
    ["buyer environment example", buyerEnv],
    ["business environment example", businessEnv],
  ]) {
    assert.match(
      source,
      new RegExp(`127\\.0\\.0\\.1:${apiPort}`),
      `${name} must target the API port`,
    );
  }
});
