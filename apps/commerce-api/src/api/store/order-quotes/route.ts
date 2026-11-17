import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createHash } from "node:crypto"
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows"
import { MercurModules } from "@mercurjs/types"

const QUOTES = "agestylesOrderQuotes"
const ttlMs = 15 * 60 * 1000

function stableIntentHash(cart: any, sellerIds: string[]) {
  const canonical = {
    cart_id: cart.id,
    currency_code: cart.currency_code,
    seller_ids: sellerIds,
    items: (cart.items ?? []).map((item: any) => ({
      id: item.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      offer_id: item.metadata?.offer_id ?? null,
    })).sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))),
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

function priceHash(cart: any) {
  const canonical = {
    currency_code: cart.currency_code,
    total: cart.total ?? 0,
    items: (cart.items ?? []).map((item: any) => ({ id: item.id, unit_price: item.unit_price })).sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))),
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

async function loadCart(req: MedusaRequest, cartId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "customer_id", "currency_code", "total", "items.id", "items.variant_id", "items.quantity", "items.unit_price", "items.title", "items.metadata"],
    filters: { id: cartId },
  })
  return data?.[0]
}

async function resolveCartSellerIds(req: MedusaRequest, cart: any): Promise<string[] | null> {
  if (!cart.items?.length) return null
  const offers = req.scope.resolve(MercurModules.OFFER) as any
  const lineSellerIds = await Promise.all(cart.items.map(async (item: any) => {
    if (!item.variant_id) return null
    const offerId = item.metadata?.offer_id
    const matches = offerId
      ? await offers.listOffers({ id: offerId })
      : await offers.listOffers({ variant_id: item.variant_id })
    const sellers = [...new Set((matches ?? [])
      .filter((offer: any) => offer.variant_id === item.variant_id)
      .map((offer: any) => offer.seller_id)
      .filter(Boolean))]
    return sellers.length === 1 ? sellers[0] as string : null
  }))
  if (lineSellerIds.some((sellerId) => !sellerId)) return null
  return [...new Set(lineSellerIds as string[])].sort()
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  const { cart_id: cartId } = req.body as { cart_id?: string }
  const key = req.headers["idempotency-key"] as string | undefined
  if (!customerId) return res.status(401).json({ code: "unauthorized" })
  if (!cartId || !key || key.length > 200) {
    return res.status(400).json({ code: "invalid_request", message: "cart_id and Idempotency-Key are required" })
  }

  let cart = await loadCart(req, cartId)
  if (!cart || cart.customer_id !== customerId) return res.status(404).json({ code: "cart_not_found" })
  // Refresh current prices, promotions, taxes, and shipping totals before the quote snapshot.
  await refreshCartItemsWorkflow(req.scope).run({ input: { cart_id: cartId, force_refresh: true } })
  cart = await loadCart(req, cartId)
  if (!cart || cart.customer_id !== customerId) return res.status(404).json({ code: "cart_not_found" })
  const sellerIds = await resolveCartSellerIds(req, cart)
  if (!sellerIds) return res.status(409).json({ code: "seller_scope_unresolved", message: "Every cart item must resolve to exactly one seller offer." })

  const service = req.scope.resolve(QUOTES) as any
  const hash = stableIntentHash(cart, sellerIds)
  const priced = priceHash(cart)
  const existing = (await service.listOrderQuotes({ customer_id: customerId, idempotency_key: key }))[0]
  if (existing) {
    if (existing.cart_id !== cartId || JSON.stringify(existing.seller_ids) !== JSON.stringify(sellerIds) || existing.intent_hash !== hash) {
      return res.status(409).json({ code: "idempotency_conflict" })
    }
    if (existing.status !== "accepted" && (existing.snapshot?.price_hash !== priced || existing.status === "expired" || existing.status === "unavailable")) {
      const refreshed = await service.updateOrderQuotes({
        id: existing.id,
        revision: existing.revision + 1,
        status: "quoted",
        available: true,
        currency_code: cart.currency_code,
        total: cart.total ?? 0,
        snapshot: { items: cart.items.map((item: any) => ({ id: item.id, variant_id: item.variant_id, title: item.title, quantity: item.quantity, unit_price: item.unit_price, seller_id: sellerIds[0] })), seller_ids: sellerIds, price_hash: priced },
        expires_at: new Date(Date.now() + ttlMs),
      })
      return res.status(200).json({ status: "requoted", quote: refreshed })
    }
    return res.status(200).json({ quote: existing })
  }

  const quote = await service.createOrderQuotes({
    cart_id: cartId,
    customer_id: customerId,
    seller_ids: sellerIds,
    idempotency_key: key,
    intent_hash: hash,
    revision: 1,
    status: "quoted",
    currency_code: cart.currency_code,
    total: cart.total ?? 0,
    available: true,
    snapshot: { items: cart.items.map((item: any) => ({ id: item.id, variant_id: item.variant_id, title: item.title, quantity: item.quantity, unit_price: item.unit_price })), seller_ids: sellerIds, price_hash: priced },
    expires_at: new Date(Date.now() + ttlMs),
  })
  return res.status(201).json({ quote })
}
