import { createServer, request } from "node:http";
import { isIP } from "node:net";

const prefix = "/agestyles-seller";
const allowedOrigins = new Set(["https://negocio.eav-labs.com"]);
const clientRequests = new Map();
const authAttempts = new Map();
let totalRequests = 0;

const reset = setInterval(() => {
  clientRequests.clear();
  authAttempts.clear();
  totalRequests = 0;
}, 60_000);
reset.unref();

const rules = [
  ["POST", /^\/auth\/member\/emailpass$/],
  ["POST", /^\/auth\/customer\/emailpass$/],
  ["GET", /^\/store\/regions$/],
  ["GET", /^\/store\/products$/],
  ["GET", /^\/store\/offers$/],
  ["POST", /^\/store\/carts$/],
  ["GET POST", /^\/store\/carts\/[a-z0-9_-]+$/i],
  ["POST", /^\/store\/carts\/[a-z0-9_-]+\/line-items$/i],
  ["POST", /^\/store\/carts\/[a-z0-9_-]+\/transfer$/i],
  ["GET", /^\/store\/customers\/me$/],
  ["POST", /^\/store\/order-quotes$/],
  ["POST", /^\/store\/order-quotes\/[a-z0-9_-]+\/accept$/i],
  ["GET", /^\/vendor\/sellers$/],
  ["POST", /^\/vendor\/sellers\/select$/],
  ["GET", /^\/vendor\/members\/me$/],
  ["GET", /^\/vendor\/(products|orders|inventory-items)$/],
  ["GET POST", /^\/vendor\/products\/[a-z0-9_-]+$/i],
  ["DELETE", /^\/vendor\/products\/[a-z0-9_-]+\/variants\/[a-z0-9_-]+$/i],
  ["POST", /^\/vendor\/inventory-items\/[a-z0-9_-]+\/location-levels\/[a-z0-9_-]+$/i],
  ["GET POST", /^\/vendor\/sellers\/sel_[a-z0-9]+\/members$/i],
  ["POST DELETE", /^\/vendor\/sellers\/sel_[a-z0-9]+\/members\/[a-z0-9_-]+$/i],
];

function reply(response, status, message, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify({ message }));
}

createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, (incoming, outgoing) => {
  if (incoming.url === "/healthz") {
    outgoing.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    return outgoing.end("ok\n");
  }

  if (!incoming.url?.startsWith(`${prefix}/`)) {
    return reply(outgoing, 404, "Route not available in the seller lab");
  }

  const url = new URL(incoming.url, "http://127.0.0.1");
  if (!url.pathname.startsWith(`${prefix}/`)) {
    return reply(outgoing, 404, "Route not available in the seller lab");
  }

  const path = url.pathname.slice(prefix.length);
  const matchingRule = rules.find(([, pattern]) => pattern.test(path));
  if (!matchingRule) return reply(outgoing, 404, "Route not available in the seller lab");

  const origin = incoming.headers.origin;
  if (typeof origin === "string" && !allowedOrigins.has(origin)) {
    return reply(outgoing, 403, "Origin not allowed");
  }

  const corsHeaders =
    typeof origin === "string"
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": `${matchingRule[0].split(" ").join(", ")}, OPTIONS`,
          "access-control-allow-headers":
            "authorization, content-type, idempotency-key, x-medusa-locale, x-publishable-api-key, x-seller-id",
          "access-control-max-age": "600",
          vary: "Origin",
        }
      : {};

  if (incoming.method === "OPTIONS") {
    const requestedMethod = incoming.headers["access-control-request-method"];
    if (
      typeof requestedMethod !== "string" ||
      !matchingRule[0].split(" ").includes(requestedMethod)
    ) {
      return reply(outgoing, 403, "Method not allowed", corsHeaders);
    }
    outgoing.writeHead(204, corsHeaders);
    return outgoing.end();
  }

  if (!matchingRule[0].split(" ").includes(incoming.method)) {
    return reply(outgoing, 404, "Route not available in the seller lab", corsHeaders);
  }

  const clientIp = incoming.headers["cf-connecting-ip"];
  const client =
    typeof clientIp === "string" && isIP(clientIp)
      ? clientIp
      : (incoming.socket.remoteAddress ?? "unknown");
  const count = clientRequests.get(client) ?? 0;
  if (count >= 120 || totalRequests >= 600)
    return reply(outgoing, 429, "Retry in a minute", corsHeaders);
  clientRequests.set(client, count + 1);

  if (path === "/auth/member/emailpass" || path === "/auth/customer/emailpass") {
    const attempts = authAttempts.get(client) ?? 0;
    if (attempts >= 8)
      return reply(outgoing, 429, "Too many sign-in attempts. Retry in a minute.", corsHeaders);
    authAttempts.set(client, attempts + 1);
  }
  totalRequests += 1;

  if (
    incoming.headers["transfer-encoding"] ||
    Number(incoming.headers["content-length"]) > 65_536
  ) {
    return reply(outgoing, 413, "Request body too large", corsHeaders);
  }

  const headers = Object.fromEntries(
    [
      "accept",
      "content-type",
      "content-length",
      "idempotency-key",
      "x-medusa-locale",
      "x-publishable-api-key",
      "authorization",
      "x-seller-id",
      "user-agent",
    ]
      .filter((name) => incoming.headers[name] !== undefined)
      .map((name) => [name, incoming.headers[name]]),
  );

  const backend = request(
    {
      host: "127.0.0.1",
      port: 19081,
      method: incoming.method,
      path: path + url.search,
      headers,
      timeout: 30_000,
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, {
        "content-type": response.headers["content-type"] ?? "application/json",
        "cache-control": "no-store",
        ...corsHeaders,
      });
      response.pipe(outgoing);
    },
  );

  backend.on("timeout", () => backend.destroy(new Error("Mercur timed out")));
  backend.on("error", () => {
    if (outgoing.headersSent) outgoing.destroy();
    else reply(outgoing, 502, "Seller lab backend unavailable", corsHeaders);
  });
  outgoing.on("close", () => backend.destroy());
  incoming.pipe(backend);
}).listen(19183, "127.0.0.1", () => {
  console.log("Seller lab gateway listening on 127.0.0.1:19183");
});
