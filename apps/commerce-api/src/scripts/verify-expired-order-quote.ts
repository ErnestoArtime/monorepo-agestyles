import type { ExecArgs } from "@medusajs/framework/types"

export default async function verifyExpiredOrderQuote({ container }: ExecArgs) {
  const databaseUrl = process.env.DATABASE_URL ?? ""
  const base = process.env.AGESTYLES_LAB_API_BASE ?? ""
  if (!/^postgres(?:ql)?:\/\/agestyles_lab:[a-f0-9]+@127\.0\.0\.1:15472\/agestyles_mercur_lab$/.test(databaseUrl) || base !== "http://127.0.0.1:19081") {
    throw new Error("This helper is restricted to the loopback AgeStyles lab database and API.")
  }
  const quoteId = process.env.AGESTYLES_LAB_QUOTE_ID
  const revision = Number(process.env.AGESTYLES_LAB_QUOTE_REVISION)
  const token = process.env.AGESTYLES_LAB_CUSTOMER_TOKEN
  const publishableKey = process.env.AGESTYLES_LAB_PUBLISHABLE_KEY
  if (!quoteId || !Number.isInteger(revision) || !token || !publishableKey) throw new Error("Missing verifier quote context.")

  const service = container.resolve("agestylesOrderQuotes") as any
  await service.updateOrderQuotes({ id: quoteId, expires_at: new Date(Date.now() - 1_000) })
  const response = await fetch(`${base}/store/order-quotes/${quoteId}/accept`, {
    method: "POST",
    headers: { "x-publishable-api-key": publishableKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ revision }),
  })
  const body = await response.json().catch(() => ({}))
  if (response.status !== 409 || body.status !== "expired") throw new Error(`Expired quote was not rejected as expected: ${response.status} ${body.status ?? body.code ?? ""}`)
  console.log("Expired quote rejected: status=expired, no order accepted.")
}
