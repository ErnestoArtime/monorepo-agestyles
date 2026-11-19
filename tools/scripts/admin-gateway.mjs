import { createServer, request } from "node:http";
import { isIP } from "node:net";

// Marketplace administration for Negocio (AG-32). Only the admin routes its screens use are
// forwarded; the rest of the Admin API stays closed. Production sets GATEWAY_PREFIX,
// GATEWAY_PORT, UPSTREAM_PORT and ALLOWED_ORIGINS in its compose service.
const prefix = process.env.GATEWAY_PREFIX ?? "/admin-app";
const listenPort = Number(process.env.GATEWAY_PORT ?? 19188);
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

const ID = "[a-z0-9_]+";
const rules = [
  // Sign-in of the `user` actor and who is signed in.
  ["POST", /^\/auth\/user\/emailpass$/],
  // Accepting an administrator invitation: create the identity, then accept with the token.
  ["POST", /^\/auth\/user\/emailpass\/register$/],
  ["POST", /^\/admin\/invites\/accept$/],
  ["GET", /^\/admin\/users\/me$/],
  // Users: administrators, invitations, customers and store members.
  ["GET", /^\/admin\/users$/],
  ["GET POST", /^\/admin\/invites$/],
  ["DELETE", new RegExp(`^/admin/invites/${ID}$`, "i")],
  ["POST", new RegExp(`^/admin/invites/${ID}/resend$`, "i")],
  ["GET", /^\/admin\/customers$/],
  ["GET", /^\/admin\/members$/],
  // Stores.
  ["GET", /^\/admin\/sellers$/],
  ["GET", new RegExp(`^/admin/sellers/${ID}$`, "i")],
  ["POST", new RegExp(`^/admin/sellers/${ID}/(approve|suspend|unsuspend)$`, "i")],
  ["GET", new RegExp(`^/admin/sellers/${ID}/members$`, "i")],
  ["GET", new RegExp(`^/admin/sellers/${ID}/members/invites$`, "i")],
  ["POST", new RegExp(`^/admin/sellers/${ID}/members/invite$`, "i")],
  // Orders and manual payments.
  ["GET", /^\/admin\/orders$/],
  ["GET", new RegExp(`^/admin/orders/${ID}$`, "i")],
  ["GET", /^\/admin\/manual-payments$/],
  ["POST", new RegExp(`^/admin/manual-payments/${ID}/(verify|reject)$`, "i")],
  // Tienda's home: banners and featured products, and the banner images.
  ["GET POST", /^\/admin\/agestyles\/home$/],
  ["GET", /^\/admin\/agestyles\/category-requests$/],
  ["GET", /^\/admin\/agestyles\/notifications$/],
  ["POST", /^\/admin\/agestyles\/notifications\/read$/],
  ["POST", /^\/admin\/agestyles\/category-requests\/catreq_[A-Za-z0-9]+$/],
  ["POST", /^\/admin\/uploads$/],
  // Product publication review.
  ["GET", /^\/admin\/product-changes$/],
  ["POST", new RegExp(`^/admin/product-changes/${ID}/(confirm|cancel)$`, "i")],
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
    return reply(outgoing, 404, "Route not available");
  }

  const url = new URL(incoming.url, "http://127.0.0.1");
  if (!url.pathname.startsWith(`${prefix}/`)) {
    return reply(outgoing, 404, "Route not available");
  }

  const path = url.pathname.slice(prefix.length);
  const matchingRule = rules.find(([, pattern]) => pattern.test(path));
  if (!matchingRule) return reply(outgoing, 404, "Route not available");

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
            "authorization, content-type, idempotency-key, x-medusa-locale",
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
    return reply(outgoing, 404, "Route not available", corsHeaders);
  }

  const clientIp = incoming.headers["cf-connecting-ip"];
  const client =
    typeof clientIp === "string" && isIP(clientIp)
      ? clientIp
      : (incoming.socket.remoteAddress ?? "unknown");
  const count = clientRequests.get(client) ?? 0;
  if (count >= 90 || totalRequests >= 300)
    return reply(outgoing, 429, "Retry in a minute", corsHeaders);
  clientRequests.set(client, count + 1);

  if (path === "/auth/user/emailpass" || path === "/auth/user/emailpass/register") {
    const attempts = authAttempts.get(client) ?? 0;
    if (attempts >= 5)
      return reply(outgoing, 429, "Too many sign-in attempts. Retry in a minute.", corsHeaders);
    authAttempts.set(client, attempts + 1);
  }
  totalRequests += 1;

  if (
    incoming.headers["transfer-encoding"] ||
    Number(incoming.headers["content-length"]) >
      (path === "/admin/uploads" ? 8 * 1024 * 1024 : 65_536)
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
      "authorization",
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
