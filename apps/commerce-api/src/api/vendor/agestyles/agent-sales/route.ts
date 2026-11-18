import type { MedusaResponse } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { applyMovement, MovementValidationError } from "@agestyles/inventory-movements";
import {
  commissionForLine,
  parseAgentSaleInput,
  resolveRule,
  roundMoney,
  type CommissionRule,
  parseSalesFilters,
  salesServiceFilters,
} from "@agestyles/sales-commissions";
import {
  asInvalidData,
  commissionsService,
  queryGraph,
  requireAgent,
  resolveCommissionActor,
  scopedAgentId,
  toNumber,
  type CommissionRequest,
} from "../../../../lib/vendor-commissions";
import { recordAgentSaleWorkflow } from "../../../../workflows/record-agent-sale";

type OfferRow = {
  id: string;
  seller_id: string;
  product_id: string;
  variant_id: string;
  sku: string | null;
  inventory_item_link?: { inventory_item_id: string }[] | { inventory_item_id: string } | null;
};
type SaleLine = { product_id: string; quantity: number };

/**
 * Agents list their own sales; managers list the store's, optionally for one agent.
 * Optional filters: `from`/`to` (YYYY-MM-DD, UTC) and `payment_method`.
 */
export async function GET(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const agentId = scopedAgentId(actor, req.query.agent_id);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const filters = parseSalesFilters(req.query as Record<string, unknown>);
  const [sales, count] = await commissionsService(req).listAndCountAgentSales(
    salesServiceFilters(actor.sellerId, filters, agentId),
    { order: { created_at: "DESC" }, take: limit, skip: offset },
  );
  res.json({ agent_sales: sales, count, limit, offset });
}

/** A sale the agent made outside the online store (shop, WhatsApp…), paid in cash or by transfer. */
export async function POST(req: CommissionRequest, res: MedusaResponse) {
  const actor = await resolveCommissionActor(req);
  const agent = requireAgent(actor);
  const input = asInvalidData(() => parseAgentSaleInput(req.body));
  const query = queryGraph(req);

  const [{ data: offerRows }, { data: ownedLocations }, { data: locations }] = await Promise.all([
    query.graph({
      entity: "offer",
      fields: ["id", "seller_id", "product_id", "variant_id", "sku", "inventory_item_link.*"],
      filters: { id: input.lines.map((line) => line.offer_id) },
    }),
    query.graph({
      entity: "stock_location_seller",
      fields: ["stock_location_id"],
      filters: { seller_id: actor.sellerId, stock_location_id: input.location_id },
    }),
    query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
      filters: { id: input.location_id },
    }),
  ]);
  if (!ownedLocations.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "The stock location was not found for this seller.",
    );
  }
  const offers = new Map((offerRows as unknown as OfferRow[]).map((offer) => [offer.id, offer]));
  const lines = input.lines.map((line) => {
    const offer = offers.get(line.offer_id);
    if (!offer || offer.seller_id !== actor.sellerId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "A product of the sale was not found in this store.",
      );
    }
    const links = Array.isArray(offer.inventory_item_link)
      ? offer.inventory_item_link
      : offer.inventory_item_link
        ? [offer.inventory_item_link]
        : [];
    if (links.length !== 1) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Solo se pueden registrar productos con un único artículo de inventario.",
      );
    }
    return { ...line, offer, inventory_item_id: links[0].inventory_item_id };
  });

  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "title", "sku"],
    filters: { id: lines.map((line) => line.inventory_item_id) },
  });
  const itemInfo = new Map(
    (items as { id: string; title?: string | null; sku?: string | null }[]).map((item) => [
      item.id,
      item,
    ]),
  );
  const locationName = (locations[0] as { name?: string } | undefined)?.name ?? null;

  const service = commissionsService(req);
  const inventory = req.scope.resolve(Modules.INVENTORY);
  const locking = req.scope.resolve(Modules.LOCKING);
  const lockKeys = [
    `agestyles-agent:${agent.id}`,
    ...lines.map((line) => `agestyles-inventory:${line.inventory_item_id}:${input.location_id}`),
  ];

  const result = await locking.execute(
    lockKeys,
    async () => {
      const rules = (await service.listCommissionRules({
        seller_id: actor.sellerId,
      })) as unknown as CommissionRule[];
      const previousSales = (await service.listAgentSales({
        agent_id: agent.id,
        status: "paid",
      })) as unknown as { lines: SaleLine[] }[];
      const unitsSold = new Map<string, number>();
      for (const sale of previousSales) {
        for (const line of sale.lines ?? []) {
          unitsSold.set(
            line.product_id,
            (unitsSold.get(line.product_id) ?? 0) + Number(line.quantity),
          );
        }
      }

      const stock: { inventory_item_id: string; location_id: string; stocked_quantity: number }[] =
        [];
      const movements: Record<string, unknown>[] = [];
      const entries: { amount: number; [key: string]: unknown }[] = [];
      const saleLines: { quantity: number; unit_price: number; [key: string]: unknown }[] = [];
      for (const line of lines) {
        const [level] = await inventory.listInventoryLevels({
          inventory_item_id: line.inventory_item_id,
          location_id: input.location_id,
        });
        if (!level) {
          throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "A product has no stock at that location.",
          );
        }
        let effect: ReturnType<typeof applyMovement>;
        try {
          effect = applyMovement(
            { type: "venta", quantity: line.quantity },
            { stocked: Number(level.stocked_quantity), reserved: Number(level.reserved_quantity) },
          );
        } catch (error) {
          if (error instanceof MovementValidationError) {
            const title = itemInfo.get(line.inventory_item_id)?.title ?? "un producto";
            throw new MedusaError(MedusaError.Types.INVALID_DATA, `${title}: ${error.message}`);
          }
          throw error;
        }
        const productId = line.offer.product_id;
        const rule = resolveRule(rules, productId);
        const commission = commissionForLine(
          rule ? { ...rule, value: Number(rule.value) } : null,
          { product_id: productId, quantity: line.quantity, unit_price: line.unit_price },
          unitsSold.get(productId) ?? 0,
        );
        unitsSold.set(productId, (unitsSold.get(productId) ?? 0) + line.quantity);
        const info = itemInfo.get(line.inventory_item_id);
        stock.push({
          inventory_item_id: line.inventory_item_id,
          location_id: input.location_id,
          stocked_quantity: effect.after,
        });
        movements.push({
          seller_id: actor.sellerId,
          inventory_item_id: line.inventory_item_id,
          location_id: input.location_id,
          type: "venta",
          delta: effect.delta,
          quantity_before: effect.before,
          quantity_after: effect.after,
          reason: `Venta del gestor ${agent.code}`,
          actor_id: actor.memberId,
          actor_email: agent.member_email,
          title: info?.title ?? null,
          sku: info?.sku ?? line.offer.sku ?? null,
          location_name: locationName,
        });
        saleLines.push({
          offer_id: line.offer.id,
          product_id: productId,
          variant_id: line.offer.variant_id,
          title: info?.title ?? null,
          sku: info?.sku ?? line.offer.sku ?? null,
          quantity: line.quantity,
          unit_price: line.unit_price,
          commission: commission.amount,
          rule_id: commission.rule_id,
        });
        if (commission.amount > 0) {
          entries.push({
            seller_id: actor.sellerId,
            agent_id: agent.id,
            kind: "earned",
            amount: commission.amount,
            currency_code: "usd",
            product_id: productId,
            units: line.quantity,
          });
        }
      }
      const total = roundMoney(
        saleLines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0),
      );
      const { result: created } = await recordAgentSaleWorkflow(req.scope).run({
        input: {
          stock,
          movements,
          sale: {
            seller_id: actor.sellerId,
            agent_id: agent.id,
            source: "manual",
            order_id: null,
            payment_method: input.payment_method,
            status: "paid",
            currency_code: "usd",
            total,
            lines: saleLines,
            note: input.note,
          },
          entries,
        },
      });
      return {
        sale: created.sale,
        commission: roundMoney(entries.reduce((sum, entry) => sum + toNumber(entry.amount), 0)),
      };
    },
    { timeout: 15 },
  );
  res.status(201).json({ agent_sale: result.sale, commission: result.commission });
}
