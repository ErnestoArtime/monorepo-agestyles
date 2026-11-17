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

  const [dockerfile, compose, runbook, buyerGateway, sellerGateway] = await Promise.all([
    readRepositoryFile("apps/commerce-api/Dockerfile.public"),
    readRepositoryFile("infra/compose/buyer-web.yaml"),
    readRepositoryFile("docs/runbooks/manual-commerce-api-publish.md"),
    readRepositoryFile("tools/scripts/buyer-lab-gateway.mjs"),
    readRepositoryFile("tools/scripts/seller-lab-gateway.mjs"),
  ]);

  assert.match(dockerfile, new RegExp(`^EXPOSE ${apiPort}$`, "m"));
  assert.match(compose, new RegExp(`127\\.0\\.0\\.1:${apiPort}/health`));
  assert.match(runbook, new RegExp(`curl -fsS http://127\\.0\\.0\\.1:${apiPort}/health`));
  for (const [name, source] of [
    ["buyer gateway", buyerGateway],
    ["seller gateway", sellerGateway],
  ]) {
    assert.match(source, new RegExp(`port:\\s*${apiPort}\\b`), `${name} must target the API port`);
  }
});
