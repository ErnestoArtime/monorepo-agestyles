/**
 * Store API projection for the buyer's marketplace order group.
 * This contract is intentionally platform-neutral so web and native clients
 * can render a mixed-vendor purchase without importing one another.
 */
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
