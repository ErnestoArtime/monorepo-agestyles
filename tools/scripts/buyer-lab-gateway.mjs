import { createServer, request } from "node:http";
import { isIP } from "node:net";

// Defaults serve the buyer lab. Production runs the same gateway with
// GATEWAY_PREFIX/GATEWAY_PORT/UPSTREAM_PORT/ALLOWED_ORIGINS set by its compose service.
const prefix = process.env.GATEWAY_PREFIX ?? "/agestyles-lab";
const listenPort = Number(process.env.GATEWAY_PORT ?? 19182);
const upstreamPort = Number(process.env.UPSTREAM_PORT ?? 19081);
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "https://tienda.eav-labs.com")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);
if (!/^(\/[a-z0-9-]+)?$/.test(prefix) || !listenPort || !upstreamPort) {
  throw new Error("Invalid gateway configuration");
}
// Maintenance flag (AG-44), read on the loopback every 15 s; unknown counts as off.
let maintenanceOn = false;
function pollMaintenance() {
  const check = request(
    {
      host: "127.0.0.1",
      port: upstreamPort,
      path: "/agestyles/maintenance",
      method: "GET",
      timeout: 5000,
    },
    (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => {
        try {
          maintenanceOn = response.statusCode === 200 && JSON.parse(body).enabled === true;
        } catch {
          maintenanceOn = false;
        }
      });
    },
  );
  check.on("error", () => undefined);
  check.on("timeout", () => check.destroy());
  check.end();
}
pollMaintenance();
setInterval(pollMaintenance, 15_000).unref();

const clientRequests = new Map();
const authAttempts = new Map();
// Password-reset requests (AG-19): a tighter per-IP bucket than sign-in, so the emailed
// link cannot be used to spam an inbox or to guess reset tokens.
const resetAttempts = new Map();
const reset = setInterval(() => {
  clientRequests.clear();
  authAttempts.clear();
  resetAttempts.clear();
}, 60_000);
reset.unref();

// Sent on every gateway response, including errors and proxied ones (P1 hardening).
const securityHeaders = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
};

// Failed sign-ins, without request bodies or credentials: IP, path and upstream status only.
function logFailedLogin(client, path, status) {
  console.warn(
    JSON.stringify({
      event: "failed_login",
      ip: client,
      path,
      status,
      at: new Date().toISOString(),
    }),
  );
}

const rules = [
  ["GET", /^\/store\/(regions|offers|shipping-options|payment-providers)$/],
  ["GET", /^\/store\/(product-categories|sellers)$/],
  ["GET", /^\/store\/sellers\/sel_[a-z0-9]+$/i],
  ["GET", /^\/store\/catalog-comparison$/],
  ["GET", /^\/store\/agestyles\/exchange-rate$/],
  ["GET", /^\/store\/agestyles\/(catalog|home|maintenance|shipping-options)$/],
  ["GET", /^\/store\/agestyles\/sales-agents\/[a-z0-9]{4,12}$/i],
  ["GET", /^\/store\/products(?:\/prod_[a-z0-9]+)?$/i],
  ["POST", /^\/store\/carts$/],
  ["GET POST", /^\/store\/carts\/cart_[a-z0-9]+$/i],
  ["POST", /^\/store\/carts\/cart_[a-z0-9]+\/(line-items|shipping-methods|complete)$/i],
  ["POST", /^\/store\/carts\/cart_[a-z0-9]+\/customer$/i],
  ["POST DELETE", /^\/store\/carts\/cart_[a-z0-9]+\/line-items\/cali_[a-z0-9]+$/i],
  ["POST", /^\/store\/payment-collections(?:\/pay_col_[a-z0-9]+\/payment-sessions)?$/i],
  ["POST", /^\/auth\/customer\/emailpass(?:\/register)?$/],
  // First sign-in of an account from the old catalog (AG-32 phase C); counted as a sign-in.
  ["POST", /^\/store\/agestyles\/legacy-login$/],
  // Choose a new password from the emailed link (AG-19); the token travels as a bearer.
  ["POST", /^\/auth\/customer\/emailpass\/(reset-password|update)$/],
  ["GET POST", /^\/store\/customers\/me$/],
  // Saved delivery addresses of the signed-in customer (Mi cuenta and checkout).
  ["GET POST", /^\/store\/customers\/me\/addresses$/],
  ["POST DELETE", /^\/store\/customers\/me\/addresses\/caddr_[a-z0-9]+$/i],
  ["GET", /^\/store\/order-groups(?:\/og_[a-z0-9]+)?$/i],
  ["GET", /^\/store\/orders\/order_[a-z0-9]+\/tracking$/i],
  // Payment proofs for one of the customer's own orders (P1 fix): the server forces a
  // customer actor (AUTHENTICATE) and only returns proofs of orders that belong to them.
  ["GET POST", /^\/store\/orders\/order_[a-z0-9]+\/manual-payments$/i],
  // Notifications (AG-19): inbox, push devices and channel preferences of the signed-in customer.
  ["GET", /^\/store\/agestyles\/notifications$/],
  ["POST", /^\/store\/agestyles\/notifications\/read$/],
  ["POST", /^\/store\/agestyles\/devices$/],
  ["DELETE", /^\/store\/agestyles\/devices\/adevice_[a-z0-9]+$/i],
  ["GET POST", /^\/store\/agestyles\/notification-preferences$/],
  ["POST", /^\/store\/order-quotes$/],
  ["POST", /^\/store\/order-quotes\/[a-z0-9_-]+\/accept$/i],
];

function reply(response, status, message, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    ...securityHeaders,
    ...headers,
  });
  response.end(JSON.stringify({ message }));
}

createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, (incoming, outgoing) => {
  if (!incoming.url?.startsWith(prefix + "/")) {
    return reply(outgoing, 404, "Route not available in the buyer lab");
  }
  const url = new URL(incoming.url, "http://127.0.0.1");
  if (!url.pathname.startsWith(prefix + "/")) {
    return reply(outgoing, 404, "Route not available in the buyer lab");
  }
  const path = url.pathname.slice(prefix.length);
  const matchingRule = rules.find(([, pattern]) => pattern.test(path));
  if (!matchingRule) return reply(outgoing, 404, "Route not available in the buyer lab");

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
            "authorization, content-type, idempotency-key, x-medusa-locale, x-publishable-api-key",
          "access-control-max-age": "600",
          vary: "Origin",
        }
      : {};

  if (incoming.method === "OPTIONS") {
    const requestedMethod = incoming.headers["access-control-request-method"];
    const methods = matchingRule[0].split(" ");
    if (typeof requestedMethod !== "string" || !methods.includes(requestedMethod)) {
      return reply(outgoing, 403, "Method not allowed", corsHeaders);
    }
    outgoing.writeHead(204, { ...securityHeaders, ...corsHeaders });
    return outgoing.end();
  }

  const allowed = matchingRule[0].split(" ").includes(incoming.method);
  if (!allowed) return reply(outgoing, 404, "Route not available in the buyer lab", corsHeaders);

  const clientIp = incoming.headers["cf-connecting-ip"];
  const client =
    typeof clientIp === "string" && isIP(clientIp) ? clientIp : incoming.socket.remoteAddress;
  // Per-IP limits only: the old shared global cap (600/min across all clients) let one
  // busy IP deny service to everyone. Redis-backed counters shared across gateway
  // replicas are the follow-up; see the P1 report.
  const count = clientRequests.get(client) ?? 0;
  if (count >= 120) return reply(outgoing, 429, "Retry in a minute", corsHeaders);
  clientRequests.set(client, count + 1);
  if (path.startsWith("/auth/customer/emailpass") || path === "/store/agestyles/legacy-login") {
    const attempts = authAttempts.get(client) ?? 0;
    if (attempts >= 10) {
      logFailedLogin(client, path, 429);
      return reply(outgoing, 429, "Too many sign-in attempts. Retry in a minute.", corsHeaders);
    }
    authAttempts.set(client, attempts + 1);
  }
  if (
    path === "/auth/customer/emailpass/reset-password" ||
    path === "/auth/customer/emailpass/update"
  ) {
    const resets = resetAttempts.get(client) ?? 0;
    if (resets >= 5)
      return reply(
        outgoing,
        429,
        "Too many password-reset attempts. Retry in a minute.",
        corsHeaders,
      );
    resetAttempts.set(client, resets + 1);
  }

  // Maintenance (AG-44): no carts or checkout while the administration has it on.
  if (
    maintenanceOn &&
    incoming.method !== "GET" &&
    /^\/store\/(carts|payment-collections|order-quotes)/.test(path)
  ) {
    return reply(
      outgoing,
      503,
      "AgeStyles está en mantenimiento. Vuelve a intentarlo en un rato.",
      corsHeaders,
    );
  }

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
      if (
        response.statusCode === 401 &&
        (path.startsWith("/auth/customer/emailpass") || path === "/store/agestyles/legacy-login")
      ) {
        logFailedLogin(client, path, response.statusCode);
      }
      outgoing.writeHead(response.statusCode, {
        "content-type": response.headers["content-type"] ?? "application/json",
        "cache-control": "no-store",
        ...securityHeaders,
        ...corsHeaders,
      });
      response.pipe(outgoing);
    },
  );
  backend.on("timeout", () => backend.destroy(new Error("Mercur timed out")));
  backend.on("error", () => {
    if (outgoing.headersSent) outgoing.destroy();
    else reply(outgoing, 502, "Buyer lab backend unavailable", corsHeaders);
  });
  outgoing.on("close", () => backend.destroy());
  incoming.pipe(backend);
}).listen(listenPort, "127.0.0.1", () => {
  console.log(
    `Buyer gateway ${prefix || "/"} listening on 127.0.0.1:${listenPort} -> ${upstreamPort}`,
  );
});
