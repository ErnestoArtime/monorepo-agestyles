import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows";

/**
 * Maintenance mode (AG-44), switched from Negocio's administration. While it is on, Tienda
 * and the Catálogo show a maintenance page and the buyer gateway refuses carts and checkout,
 * so nobody pays halfway through. Kept in the base store's metadata (no migration).
 */
export type Maintenance = {
  enabled: boolean;
  title: string;
  message: string;
  /** Free text such as «hoy a las 18:00»; shown as «Volvemos …». */
  back_at: string | null;
  updated_at: string | null;
};

const KEY = "agestyles_maintenance";
export const DEFAULT_MAINTENANCE: Maintenance = {
  enabled: false,
  title: "Estamos mejorando AgeStyles",
  message: "La tienda vuelve en un rato. Gracias por tu paciencia.",
  back_at: null,
  updated_at: null,
};

type Scope = Pick<MedusaContainer, "resolve">;

async function baseStore(scope: Scope) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as {
    graph(input: { entity: string; fields: string[] }): Promise<{
      data: { id: string; metadata?: Record<string, unknown> | null }[];
    }>;
  };
  const { data } = await query.graph({ entity: "store", fields: ["id", "metadata"] });
  if (!data[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Base store not found.");
  return data[0];
}

export async function readMaintenance(scope: Scope): Promise<Maintenance> {
  const stored = (await baseStore(scope)).metadata?.[KEY] as Partial<Maintenance> | undefined;
  return { ...DEFAULT_MAINTENANCE, ...(stored ?? {}) };
}

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

export function parseMaintenance(body: unknown): Omit<Maintenance, "updated_at"> {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (typeof raw.enabled !== "boolean")
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Indica si el mantenimiento está activo.",
    );
  return {
    enabled: raw.enabled,
    title: text(raw.title, 80) ?? DEFAULT_MAINTENANCE.title,
    message: text(raw.message, 400) ?? DEFAULT_MAINTENANCE.message,
    back_at: text(raw.back_at, 60),
  };
}

export async function writeMaintenance(scope: Scope, value: Omit<Maintenance, "updated_at">) {
  const store = await baseStore(scope);
  const next: Maintenance = { ...value, updated_at: new Date().toISOString() };
  await updateStoresWorkflow(scope as MedusaContainer).run({
    input: {
      selector: { id: store.id },
      update: { metadata: { ...(store.metadata ?? {}), [KEY]: next } },
    },
  });
  return next;
}
