import type { StoreClient } from "./transport"

export type BuyerOrderGroup = {
  id: string
  display_id: number | null
  created_at: string
  seller_count: number
  total: number
  orders: {
    id: string
    display_id: number
    currency_code: string
    status: string
    fulfillment_status?: string
    payment_status?: string
    total: number
    seller?: { id: string; name: string } | null
  }[]
}

export type BuyerOrderGroupDetail = Omit<BuyerOrderGroup, "orders"> & {
  orders: (BuyerOrderGroup["orders"][number] & {
    items: {
      id: string
      title: string
      quantity: number
      total: number
    }[]
  })[]
}

type BuyerOrderGroupList = {
  order_groups: BuyerOrderGroup[]
  count: number
  limit: number
  offset: number
}

const summaryFields = [
  "id", "display_id", "created_at", "seller_count", "total",
  "orders.id", "orders.display_id", "orders.currency_code",
  "orders.status", "orders.fulfillment_status", "orders.payment_status", "orders.total",
  "orders.seller.id", "orders.seller.name",
].join(",")

const detailFields = [
  summaryFields, "orders.items.id", "orders.items.title", "orders.items.quantity", "orders.items.total",
].join(",")

// Pass the authenticated customer's Store client. Mercur scopes these reads to that customer.
export function listBuyerOrderGroups(client: StoreClient, { offset = 0, limit = 20 } = {}) {
  return client.fetch<BuyerOrderGroupList>("/store/order-groups", {
    query: { offset, limit, order: "-created_at", fields: summaryFields },
  })
}

export function getBuyerOrderGroup(client: StoreClient, groupId: string) {
  return client.fetch<{ order_group: BuyerOrderGroupDetail }>(
    `/store/order-groups/${encodeURIComponent(groupId)}`,
    { query: { fields: detailFields } },
  )
}
