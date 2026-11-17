import type { ExecArgs } from "@medusajs/framework/types"
import { approveSellerWorkflow } from "@mercurjs/core/workflows"

const LAB_SELLERS = ["agestyles-lab-a2", "agestyles-lab-b2"]

export default async function approveLabSellers({ container }: ExecArgs) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is required")

  const database = new URL(databaseUrl)
  if (
    database.hostname !== "127.0.0.1" ||
    database.port !== "15472" ||
    database.pathname !== "/agestyles_mercur_lab"
  ) {
    throw new Error("Refusing to approve sellers outside the isolated Mercur lab")
  }

  const query = container.resolve("query")
  for (const handle of LAB_SELLERS) {
    const { data: sellers } = await query.graph({
      entity: "seller",
      fields: ["id", "handle", "status", "metadata"],
      filters: { handle },
    })

    if (sellers.length !== 1) {
      throw new Error(`Expected exactly one lab seller for ${handle}`)
    }
    const seller = sellers[0] as {
      id: string
      handle: string
      status: string
      metadata?: Record<string, unknown> | null
    }

    if (
      seller.metadata?.agestyles_lab_fixture !== "multi-store-v1"
    ) {
      throw new Error(`Refusing to approve unmarked seller ${handle}`)
    }

    if (seller.status === "approved") continue
    if (seller.status !== "pending_approval") {
      throw new Error(`Unexpected ${handle} status: ${seller.status}`)
    }

    await approveSellerWorkflow(container).run({ input: { seller_id: seller.id } })
    console.info(`Approved isolated lab seller ${handle}`)
  }
}
