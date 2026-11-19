import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import CategoryRequest from "./models/category-request";
import { CategoryRequestValidationError, validateCategoryRequestInput } from "./validation";

export type CategoryRequestStatus = "pending" | "approved" | "merged" | "rejected";

export type CategoryRequestRecord = {
  id: string;
  seller_id: string;
  requested_by: string;
  name: string;
  description: string | null;
  suggested_parent_id: string | null;
  note: string | null;
  status: CategoryRequestStatus;
  resolved_category_id: string | null;
  resolution_note: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
};

/** At most this many open requests per store, so a store cannot flood the inbox. */
export const MAX_PENDING_PER_STORE = 10;

/**
 * Category requests. Creating the category in Medusa is the route's job (a core
 * workflow); this service keeps the request and the decision, once.
 */
class CategoryRequestsService extends MedusaService({ CategoryRequest }) {
  async submitRequest(
    sellerId: string,
    memberId: string,
    raw: unknown,
  ): Promise<CategoryRequestRecord> {
    let input;
    try {
      input = validateCategoryRequestInput(raw);
    } catch (error) {
      if (error instanceof CategoryRequestValidationError) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message);
      }
      throw error;
    }
    const pending = (await this.listCategoryRequests({
      seller_id: sellerId,
      status: "pending",
    })) as unknown as CategoryRequestRecord[];
    if (pending.some((request) => request.name.toLowerCase() === input.name.toLowerCase())) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        "Ya tienes una solicitud pendiente con ese nombre.",
      );
    }
    if (pending.length >= MAX_PENDING_PER_STORE) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Puedes tener como máximo ${MAX_PENDING_PER_STORE} solicitudes pendientes.`,
      );
    }
    return (await this.createCategoryRequests({
      ...input,
      seller_id: sellerId,
      requested_by: memberId,
    })) as unknown as CategoryRequestRecord;
  }

  /** The decision is recorded once; a decided request cannot be decided again. */
  async resolveRequest(
    id: string,
    resolution: {
      status: Exclude<CategoryRequestStatus, "pending">;
      resolved_category_id: string | null;
      resolution_note: string | null;
      reviewed_by: string;
    },
  ): Promise<CategoryRequestRecord> {
    const request = await this.retrievePending(id);
    return (await this.updateCategoryRequests({
      id: request.id,
      ...resolution,
      reviewed_at: new Date(),
    })) as unknown as CategoryRequestRecord;
  }

  async retrievePending(id: string): Promise<CategoryRequestRecord> {
    const request = (await this.retrieveCategoryRequest(id)) as unknown as CategoryRequestRecord;
    if (request.status !== "pending") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Esta solicitud ya se resolvió.");
    }
    return request;
  }
}

export default CategoryRequestsService;
