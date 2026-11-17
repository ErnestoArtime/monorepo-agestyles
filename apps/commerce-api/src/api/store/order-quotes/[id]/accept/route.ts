import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { completeCartWithSplitOrdersWorkflow } from "@mercurjs/core/workflows"
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import { MercurModules } from "@mercurjs/types"

const QUOTES = "agestylesOrderQuotes"

type QuoteAcceptanceRules = {
  decideOrderQuoteAcceptance(
    quote: any,
    requestedRevision: number,
  ): QuoteAcceptanceDecision
  orderQuoteAcceptedUpdate(orderGroupId: string): Record<string, unknown>
  orderQuoteAcceptingUpdate(): Record<string, unknown>
  orderQuoteExpiredUpdate(): Record<string, unknown>
  orderQuoteRepricedUpdate(
    quote: any,
    changes: Record<string, unknown>,
  ): Record<string, unknown>
  orderQuoteUnavailableUpdate(quote: any): Record<string, unknown>
}

type QuoteAcceptanceDecision =
  | { kind: "invalid_revision" }
  | { kind: "already_accepted"; revision: number; order_group_id: string | null }
  | { kind: "stale_revision"; revision: number }
  | { kind: "expired"; revision: number }
  | { kind: "unavailable"; revision: number }
  | { kind: "accept"; revision: number }

/*
 * The domain package is ESM while this Medusa app compiles to CommonJS. Load
 * its pure quote rules through a cached dynamic import, as for other domain
 * rules in this app.
 */
let quoteAcceptanceRules: Promise<QuoteAcceptanceRules> | undefined
function loadQuoteAcceptanceRules(): Promise<QuoteAcceptanceRules> {
  quoteAcceptanceRules ??= import(
    "@agestyles/domain/order-quotes"
  ) as unknown as Promise<QuoteAcceptanceRules>
  return quoteAcceptanceRules
}

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
    fields: ["id", "customer_id", "currency_code", "total", "items.id", "items.variant_id", "items.quantity", "items.unit_price", "items.metadata"],
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

async function loadOrderGroup(req: MedusaRequest, groupId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const { data } = await query.graph({
    entity: "order_group",
    fields: ["id", "orders.id", "orders.seller.id"],
    filters: { id: groupId },
  })
  return data?.[0]
}

function acceptedResponse(group: any, revision: number) {
  const orders = (group?.orders ?? []).map((order: any) => ({ id: order.id, seller_id: order.seller?.id ?? null }))
  return { status: "accepted", revision, order_group_id: group?.id, orders }
}

async function respondToAcceptancePrecondition(
  req: MedusaRequest,
  res: MedusaResponse,
  quote: any,
  requestedRevision: number,
) {
  const rules = await loadQuoteAcceptanceRules()
  const decision = rules.decideOrderQuoteAcceptance(quote, requestedRevision)
  switch (decision.kind) {
    case "invalid_revision":
      return res.status(400).json({ code: "revision_required" })
    case "already_accepted": {
      if (!decision.order_group_id) {
        return res.status(409).json({
          status: "acceptance_pending_reconciliation",
          code: "accepted_quote_missing_order_group",
        })
      }
      const group = await loadOrderGroup(req, decision.order_group_id)
      if (!group) {
        return res.status(409).json({
          status: "acceptance_pending_reconciliation",
          code: "accepted_order_group_not_found",
        })
      }
      return res.status(200).json(acceptedResponse(group, decision.revision))
    }
    case "stale_revision":
      return res.status(409).json({ code: "stale_revision", revision: decision.revision })
    case "expired":
      await (req.scope.resolve(QUOTES) as any).updateOrderQuotes({
        id: quote.id,
        ...rules.orderQuoteExpiredUpdate(),
      })
      return res.status(409).json({ status: decision.kind, revision: decision.revision })
    case "unavailable":
      return res.status(409).json({ status: decision.kind, revision: decision.revision })
    case "accept":
      return null
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id
  const quoteId = req.params.id
  const revision = Number((req.body as any)?.revision)
  if (!customerId) return res.status(401).json({ code: "unauthorized" })

  const service = req.scope.resolve(QUOTES) as any
  const quote = (await service.listOrderQuotes({ id: quoteId, customer_id: customerId }))[0]
  if (!quote) return res.status(404).json({ code: "quote_not_found" })
  const initialPrecondition = await respondToAcceptancePrecondition(req, res, quote, revision)
  if (initialPrecondition) return initialPrecondition

  const cart = await loadCart(req, quote.cart_id)
  if (!cart || cart.customer_id !== customerId) return res.status(404).json({ code: "cart_not_found" })
  const sellerIds = await resolveCartSellerIds(req, cart)
  if (!sellerIds || JSON.stringify(sellerIds) !== JSON.stringify(quote.seller_ids)) return res.status(409).json({ code: "seller_scope_mismatch" })
  if (stableIntentHash(cart, sellerIds) !== quote.intent_hash) return res.status(409).json({ code: "cart_intent_changed", message: "The cart changed after this quote; request a new quote." })
  const priced = priceHash(cart)
  if (priced !== quote.snapshot?.price_hash) {
    const rules = await loadQuoteAcceptanceRules()
    const next = await service.updateOrderQuotes({
      id: quote.id,
      ...rules.orderQuoteRepricedUpdate(quote, {
        currency_code: cart.currency_code,
        total: cart.total ?? 0,
        snapshot: { ...quote.snapshot, items: cart.items.map((item: any) => ({ id: item.id, variant_id: item.variant_id, quantity: item.quantity, unit_price: item.unit_price })), price_hash: priced },
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
      }),
    })
    return res.status(409).json({ status: "requoted", quote: next })
  }

  const locking = req.scope.resolve("locking") as any
  const lock = await locking.acquire(`agestyles-quote:${quote.cart_id}`, { timeout: 30_000, ttl: 60_000 })
  try {
    const latest = (await service.listOrderQuotes({ id: quote.id, customer_id: customerId }))[0]
    const latestPrecondition = await respondToAcceptancePrecondition(req, res, latest, revision)
    if (latestPrecondition) return latestPrecondition

    await refreshCartItemsWorkflow(req.scope).run({ input: { cart_id: quote.cart_id, force_refresh: true } })
    const lockedCart = await loadCart(req, quote.cart_id)
    if (!lockedCart || lockedCart.customer_id !== customerId) return res.status(404).json({ code: "cart_not_found" })
    const lockedSellers = await resolveCartSellerIds(req, lockedCart)
    if (!lockedSellers || JSON.stringify(lockedSellers) !== JSON.stringify(latest.seller_ids)) return res.status(409).json({ code: "seller_scope_mismatch" })
    if (stableIntentHash(lockedCart, lockedSellers) !== latest.intent_hash) return res.status(409).json({ code: "cart_intent_changed", message: "The cart changed after this quote; request a new quote." })
    const lockedPriceHash = priceHash(lockedCart)
    if (lockedPriceHash !== latest.snapshot?.price_hash) {
      const rules = await loadQuoteAcceptanceRules()
      const refreshed = await service.updateOrderQuotes({
        id: latest.id,
        ...rules.orderQuoteRepricedUpdate(latest, {
          available: true,
          currency_code: lockedCart.currency_code,
          total: lockedCart.total ?? 0,
          snapshot: { ...latest.snapshot, items: lockedCart.items.map((item: any) => ({ id: item.id, variant_id: item.variant_id, quantity: item.quantity, unit_price: item.unit_price })), price_hash: lockedPriceHash },
          expires_at: new Date(Date.now() + 15 * 60 * 1000),
        }),
      })
      return res.status(409).json({ status: "requoted", quote: refreshed })
    }

    const rules = await loadQuoteAcceptanceRules()
    await service.updateOrderQuotes({ id: quote.id, ...rules.orderQuoteAcceptingUpdate() })
    // Mercur's supported workflow completes the entire cart into an order group
    // and one child order per seller; it also returns the prior group on cart retries.
    const { result, errors } = await completeCartWithSplitOrdersWorkflow(req.scope).run({
      input: { cart_id: quote.cart_id },
      throwOnError: false,
    })
    if (errors?.[0]) throw errors[0].error
    if (!result?.order_group_id) throw new Error("Mercur completed the cart without returning its order group ID.")
    const group = await loadOrderGroup(req, result.order_group_id)
    const childSellerIds = [...new Set((group?.orders ?? []).map((order: any) => order.seller?.id).filter(Boolean))].sort()
    if (!group || JSON.stringify(childSellerIds) !== JSON.stringify(latest.seller_ids) || group.orders?.length !== latest.seller_ids.length) {
      throw new Error("Mercur order group did not resolve to exactly one child order per quoted seller.")
    }
    await service.updateOrderQuotes({ id: quote.id, ...rules.orderQuoteAcceptedUpdate(group.id) })
    return res.status(200).json(acceptedResponse(group, revision))
  } catch (error: any) {
    const message = error?.message ?? ""
    const insufficientInventory = error?.code === MedusaError.Codes.INSUFFICIENT_INVENTORY || /does not have sufficient stock|insufficient inventory|not enough stock available/i.test(message)
    if (insufficientInventory) {
      const rules = await loadQuoteAcceptanceRules()
      const unavailable = await service.updateOrderQuotes({
        id: quote.id,
        ...rules.orderQuoteUnavailableUpdate(quote),
      })
      return res.status(409).json({ status: "unavailable", quote: unavailable })
    }
    // An accepting retry uses Mercur's cart/order_group guard to recover the same group.
    return res.status(409).json({ status: "acceptance_pending_reconciliation", code: "acceptance_not_confirmed", message: message || "Cart completion did not confirm an order group." })
  } finally {
    await lock.release()
  }
}
