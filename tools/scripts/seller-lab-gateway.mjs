import { createServer, request } from "node:http";
import { isIP } from "node:net";

// Defaults serve the seller lab. Production runs the same gateway with
// GATEWAY_PREFIX/GATEWAY_PORT/UPSTREAM_PORT/ALLOWED_ORIGINS set by its compose service.
const prefix = process.env.GATEWAY_PREFIX ?? "/agestyles-seller";
const listenPort = Number(process.env.GATEWAY_PORT ?? 19183);
const upstreamPort = Number(process.env.UPSTREAM_PORT ?? 19081);
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "https://negocio.eav-labs.com")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
if (!/^(\/[a-z0-9-]+)?$/.test(prefix) || !listenPort || !upstreamPort) {
  throw new Error("Invalid gateway configuration");
}
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
  // Choose a new password from the emailed link (AG-19); the token travels as a bearer.
  ["POST", /^\/auth\/(member|customer)\/emailpass\/(reset-password|update)$/],
  ["GET", /^\/store\/regions$/],
  ["GET", /^\/store\/products$/],
  ["GET", /^\/store\/offers$/],
  ["POST", /^\/store\/carts$/],
  ["GET POST", /^\/store\/carts\/[a-z0-9_-]+$/i],
  ["POST", /^\/store\/carts\/[a-z0-9_-]+\/line-items$/i],
  ["POST", /^\/store\/carts\/[a-z0-9_-]+\/transfer$/i],
  ["GET", /^\/store\/customers\/me$/],
  // Notifications of the buyer mode (AG-19).
  ["GET", /^\/store\/agestyles\/notifications$/],
  ["POST", /^\/store\/agestyles\/notifications\/read$/],
  ["POST", /^\/store\/agestyles\/devices$/],
  ["DELETE", /^\/store\/agestyles\/devices\/adevice_[a-z0-9]+$/i],
  ["GET POST", /^\/store\/agestyles\/notification-preferences$/],
  ["POST", /^\/store\/order-quotes$/],
  ["POST", /^\/store\/order-quotes\/[a-z0-9_-]+\/accept$/i],
  ["GET", /^\/vendor\/sellers$/],
  ["GET POST", /^\/vendor\/sellers\/me$/],
  ["GET POST", /^\/vendor\/agestyles\/(store-home|store-sections|category-requests)$/],
  ["GET", /^\/vendor\/agestyles\/analytics$/],
  // Product form (AG-42): marketplace categories, sizes and brands to choose from.
  ["GET", /^\/vendor\/product-categories$/],
  ["GET", /^\/vendor\/product-attributes$/],
  ["POST", /^\/vendor\/sellers\/select$/],
  ["GET", /^\/vendor\/members\/me$/],
  // One rule per path: the first path match decides, so GET and POST must share it.
  ["GET POST", /^\/vendor\/products$/],
  // Product photos (AG-26): Mercur's multipart upload, gated by products/store edit rights.
  ["POST", /^\/vendor\/uploads$/],
  // AI Studio (AG-27): status, copy drafts and background removal; owner-only on the server.
  ["GET", /^\/vendor\/agestyles\/ai-studio$/],
  ["POST", /^\/vendor\/agestyles\/ai-studio\/(describe|remove-background)$/],
  ["GET", /^\/vendor\/(orders|inventory-items)$/],
  ["GET", /^\/vendor\/orders\/order_[a-z0-9_-]+$/i],
  ["GET", /^\/vendor\/stock-locations$/],
  ["POST", /^\/vendor\/agestyles\/orders\/order_[a-z0-9_-]+\/fulfillments$/i],
  ["GET POST", /^\/vendor\/products\/[a-z0-9_-]+$/i],
  ["GET POST", /^\/vendor\/products\/[a-z0-9_-]+\/variants$/i],
  ["POST DELETE", /^\/vendor\/products\/[a-z0-9_-]+\/variants\/[a-z0-9_-]+$/i],
  // Stock changes go through the movement history (AG-03); the direct
  // location-level write is not exposed so nothing bypasses the history.
  ["GET POST", /^\/vendor\/agestyles\/inventory-movements$/],
  ["GET", /^\/vendor\/agestyles\/inventory-movements\/export$/],
  // Sales agents and commissions (AG-06); authorization is enforced by the API.
  ["GET POST", /^\/vendor\/agestyles\/sales-agents$/],
  ["POST", /^\/vendor\/agestyles\/sales-agents\/sagent_[a-z0-9]+$/i],
  ["GET POST", /^\/vendor\/agestyles\/commission-rules$/],
  ["DELETE", /^\/vendor\/agestyles\/commission-rules\/crule_[a-z0-9]+$/i],
  ["GET POST", /^\/vendor\/agestyles\/agent-sales$/],
  ["GET", /^\/vendor\/agestyles\/commissions\/(balance|report)$/],
  ["GET", /^\/vendor\/agestyles\/agent-sales\/export$/],
  ["POST", /^\/vendor\/agestyles\/agent-sales\/asale_[a-z0-9]+\/reverse$/i],
  ["GET POST", /^\/vendor\/agestyles\/commission-withdrawals$/],
  ["POST", /^\/vendor\/agestyles\/commission-withdrawals\/cwdraw_[a-z0-9]+$/i],
  // Notifications of the selected store (AG-19); authorization is enforced by the API.
  ["GET", /^\/vendor\/agestyles\/notifications$/],
  ["POST", /^\/vendor\/agestyles\/notifications\/read$/],
  ["POST", /^\/vendor\/agestyles\/devices$/],
  ["DELETE", /^\/vendor\/agestyles\/devices\/adevice_[a-z0-9]+$/i],
  ["GET POST", /^\/vendor\/agestyles\/notification-preferences$/],
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
    Number(incoming.headers["content-length"]) >
      (path === "/vendor/uploads" ? 8 * 1024 * 1024 : 65_536)
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
      port: upstreamPort,
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
}).listen(listenPort, "127.0.0.1", () => {
  console.log(
    `Seller gateway ${prefix || "/"} listening on 127.0.0.1:${listenPort} -> ${upstreamPort}`,
  );
});
