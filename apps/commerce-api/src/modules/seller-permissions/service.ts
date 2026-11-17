import {
  PERMISSION_RIGHT_RANK,
  SellerRole,
  type IPermissionResolver,
  type PermissionActor,
  type PermissionDefinition,
  type PermissionMap,
} from "@mercurjs/types";

type SellerMembership = {
  id: string;
  member_id: string;
  seller_id: string;
  role_id: string | null;
  is_owner: boolean;
};

type SellerService = {
  listSellerMembers(filters: {
    id: string;
    member_id: string;
    seller_id: string;
  }): Promise<SellerMembership[]>;
};

const inventoryPermissions: PermissionMap = {
  inventory_items: "edit",
  reservations: "view",
  stock_locations: "view",
};

const readOnlyPermissions: PermissionMap = {
  inventory_items: "view",
  stock_locations: "view",
  products: "view",
  offers: "view",
  orders: "view",
};

export default class SellerPermissionsService implements IPermissionResolver {
  private seller: SellerService;

  constructor({ seller }: { seller: SellerService }) {
    this.seller = seller;
  }

  async resolvePermissions(
    actor: PermissionActor,
    catalog: PermissionDefinition[],
  ): Promise<PermissionMap> {
    if (actor.surface === "admin" && actor.actor_type === "user") {
      return this.fullPermissions(catalog, "admin");
    }
    if (
      actor.surface !== "vendor" ||
      actor.actor_type !== "member" ||
      !actor.seller_id ||
      !actor.seller_member_id
    ) {
      return {};
    }

    const [membership] = await this.seller.listSellerMembers({
      id: actor.seller_member_id,
      member_id: actor.actor_id,
      seller_id: actor.seller_id,
    });
    if (
      !membership ||
      membership.id !== actor.seller_member_id ||
      membership.member_id !== actor.actor_id ||
      membership.seller_id !== actor.seller_id
    ) {
      return {};
    }
    if (membership.is_owner || membership.role_id === SellerRole.SELLER_ADMINISTRATION) {
      return this.fullPermissions(catalog, "vendor");
    }
    if (membership.role_id === SellerRole.INVENTORY_MANAGEMENT) return { ...inventoryPermissions };
    // Mercur's invitation API accepts a fixed enum. This lab uses SUPPORT for the read-only profile.
    if (membership.role_id === SellerRole.SUPPORT) return { ...readOnlyPermissions };
    return {};
  }

  private fullPermissions(
    catalog: PermissionDefinition[],
    surface: PermissionActor["surface"],
  ): PermissionMap {
    return Object.fromEntries(
      catalog
        .filter((definition) => definition.surface.includes(surface))
        .map(({ key, rights }) => [
          key,
          rights.reduce((highest, right) =>
            PERMISSION_RIGHT_RANK[right] > PERMISSION_RIGHT_RANK[highest] ? right : highest,
          ),
        ]),
    );
  }
}
