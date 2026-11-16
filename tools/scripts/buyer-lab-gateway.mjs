import { createServer, request } from "node:http"
import { isIP } from "node:net"

const prefix = "/agestyles-lab"
const clientRequests = new Map()
let totalRequests = 0
const reset = setInterval(() => {
  clientRequests.clear()
  totalRequests = 0
}, 60_000)
reset.unref()

const rules = [
  ["GET", /^\/store\/(regions|offers|shipping-options|payment-providers)$/],
  ["GET", /^\/store\/products(?:\/prod_[a-z0-9]+)?$/i],
  ["POST", /^\/store\/carts$/],
  ["GET POST", /^\/store\/carts\/cart_[a-z0-9]+$/i],
  ["POST", /^\/store\/carts\/cart_[a-z0-9]+\/(line-items|shipping-methods|complete)$/i],
  ["POST DELETE", /^\/store\/carts\/cart_[a-z0-9]+\/line-items\/cali_[a-z0-9]+$/i],
  ["POST", /^\/store\/payment-collections(?:\/pay_col_[a-z0-9]+\/payment-sessions)?$/i],
]

function reply(response, status, message) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" })
  response.end(JSON.stringify({ message }))
}

createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, (incoming, outgoing) => {
  if (!incoming.url?.startsWith(prefix + "/")) {
    return reply(outgoing, 404, "Route not available in the buyer lab")
  }
  const url = new URL(incoming.url, "http://127.0.0.1")
  if (!url.pathname.startsWith(prefix + "/")) {
    return reply(outgoing, 404, "Route not available in the buyer lab")
  }
  const path = url.pathname.slice(prefix.length)
  const allowed = rules.some(([methods, pattern]) =>
    methods.split(" ").includes(incoming.method) && pattern.test(path)
  )
  if (!allowed) return reply(outgoing, 404, "Route not available in the buyer lab")

  const clientIp = incoming.headers["cf-connecting-ip"]
  const client = typeof clientIp === "string" && isIP(clientIp) ? clientIp : incoming.socket.remoteAddress
  const count = clientRequests.get(client) ?? 0
  if (count >= 120 || totalRequests >= 600) return reply(outgoing, 429, "Retry in a minute")
  clientRequests.set(client, count + 1)
  totalRequests += 1

  if (incoming.headers["transfer-encoding"] || Number(incoming.headers["content-length"]) > 65_536) {
    return reply(outgoing, 413, "Request body too large")
  }

  const headers = Object.fromEntries(
    ["accept", "content-type", "content-length", "x-publishable-api-key", "user-agent"]
      .filter((name) => incoming.headers[name] !== undefined)
      .map((name) => [name, incoming.headers[name]]),
  )
  const backend = request({
    host: "127.0.0.1",
    port: 19080,
    method: incoming.method,
    path: path + url.search,
    headers,
    timeout: 30_000,
  }, (response) => {
    outgoing.writeHead(response.statusCode, {
      "content-type": response.headers["content-type"] ?? "application/json",
      "cache-control": "no-store",
    })
    response.pipe(outgoing)
  })
  backend.on("timeout", () => backend.destroy(new Error("Mercur timed out")))
  backend.on("error", () => {
    if (outgoing.headersSent) outgoing.destroy()
    else reply(outgoing, 502, "Buyer lab backend unavailable")
  })
  outgoing.on("close", () => backend.destroy())
  incoming.pipe(backend)
}).listen(19182, "127.0.0.1", () => {
  console.log("Buyer lab gateway listening on 127.0.0.1:19182")
})
