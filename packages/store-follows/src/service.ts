import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import StoreFollow from "./models/store-follow";
import { MAX_FOLLOWS_PER_CUSTOMER } from "./rules";

export type StoreFollowRecord = {
  id: string;
  customer_id: string;
  seller_id: string;
  notify_new_products: boolean;
  created_at: Date;
};

const PAGE = 500;

/**
 * Follows of stores by customers. Every method is scoped by `customer_id`, which the route
 * takes from the session, never from the request: one customer cannot read or change another's.
 */
class StoreFollowsService extends MedusaService({ StoreFollow }) {
  async listFollows(customerId: string): Promise<StoreFollowRecord[]> {
    const rows = (await this.listStoreFollows(
      { customer_id: customerId },
      { order: { created_at: "DESC" }, take: MAX_FOLLOWS_PER_CUSTOMER },
    )) as unknown as StoreFollowRecord[];
    return rows;
  }

  async findFollow(customerId: string, sellerId: string): Promise<StoreFollowRecord | null> {
    const [row] = (await this.listStoreFollows(
      { customer_id: customerId, seller_id: sellerId },
      { take: 1 },
    )) as unknown as StoreFollowRecord[];
    return row ?? null;
  }

  /** Idempotent: following twice keeps one row; `notify` only changes when it is given. */
  async follow(
    customerId: string,
    sellerId: string,
    notify?: boolean,
  ): Promise<{ follow: StoreFollowRecord; created: boolean }> {
    const existing = await this.findFollow(customerId, sellerId);
    if (existing) {
      if (notify === undefined || notify === existing.notify_new_products) {
        return { follow: existing, created: false };
      }
      return { follow: await this.setNotify(customerId, sellerId, notify), created: false };
    }
    const total = (await this.listFollows(customerId)).length;
    if (total >= MAX_FOLLOWS_PER_CUSTOMER) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Puedes seguir como máximo ${MAX_FOLLOWS_PER_CUSTOMER} tiendas.`,
      );
    }
    try {
      const created = (await this.createStoreFollows({
        customer_id: customerId,
        seller_id: sellerId,
        notify_new_products: notify ?? false,
      })) as unknown as StoreFollowRecord;
      return { follow: created, created: true };
    } catch (error) {
      // Two taps at once: the unique index let one through; return the winner.
      const winner = await this.findFollow(customerId, sellerId);
      if (winner) return { follow: winner, created: false };
      throw error;
    }
  }

  async unfollow(customerId: string, sellerId: string): Promise<boolean> {
    const existing = await this.findFollow(customerId, sellerId);
    if (!existing) return false;
    await this.deleteStoreFollows(existing.id);
    return true;
  }

  async setNotify(
    customerId: string,
    sellerId: string,
    enabled: boolean,
  ): Promise<StoreFollowRecord> {
    const existing = await this.findFollow(customerId, sellerId);
    if (!existing) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "No sigues esta tienda.");
    }
    return (await this.updateStoreFollows({
      id: existing.id,
      notify_new_products: enabled,
    })) as unknown as StoreFollowRecord;
  }

  /** Customers who asked to be told about this store's new products. */
  async notifiableCustomerIds(sellerId: string): Promise<string[]> {
    const ids: string[] = [];
    for (let skip = 0; ; skip += PAGE) {
      const rows = (await this.listStoreFollows(
        { seller_id: sellerId, notify_new_products: true },
        { take: PAGE, skip, order: { created_at: "ASC" } },
      )) as unknown as StoreFollowRecord[];
      ids.push(...rows.map((row) => row.customer_id));
      if (rows.length < PAGE) return ids;
    }
  }
}

export default StoreFollowsService;
