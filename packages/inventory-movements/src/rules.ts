/**
 * Pure rules for inventory movements, shared by the Commerce API and its tests.
 * Mirrors the legacy AgeStyles "Movimientos" module: entries (alta), exits
 * (baja), sales registered outside the platform (venta) and quick adjustments
 * (ajuste) to the counted physical stock, which always need a reason.
 */

export const MOVEMENT_TYPES = ["alta", "baja", "venta", "ajuste"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MAX_REASON_LENGTH = 300;
export const MAX_QUANTITY = 1_000_000;

export class MovementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovementValidationError";
  }
}

export type MovementInput = {
  inventory_item_id: string;
  location_id: string;
  type: MovementType;
  /** Units moved for alta/baja/venta; the counted stock for ajuste. */
  quantity: number;
  reason: string | null;
};

function fail(message: string): never {
  throw new MovementValidationError(message);
}

export function parseMovementInput(body: unknown): MovementInput {
  if (!body || typeof body !== "object") fail("Faltan los datos del movimiento.");
  const raw = body as Record<string, unknown>;
  const inventoryItemId =
    typeof raw.inventory_item_id === "string" ? raw.inventory_item_id.trim() : "";
  const locationId = typeof raw.location_id === "string" ? raw.location_id.trim() : "";
  if (!inventoryItemId) fail("Elige el artículo de inventario.");
  if (!locationId) fail("Elige la ubicación.");
  if (typeof raw.type !== "string" || !MOVEMENT_TYPES.includes(raw.type as MovementType)) {
    fail("El tipo de movimiento no es válido.");
  }
  const type = raw.type as MovementType;
  const quantity = typeof raw.quantity === "string" ? Number(raw.quantity) : raw.quantity;
  if (
    typeof quantity !== "number" ||
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    quantity > MAX_QUANTITY
  ) {
    fail("La cantidad debe ser un número entero entre 0 y 1.000.000.");
  }
  if (type !== "ajuste" && quantity === 0) fail("La cantidad debe ser mayor que cero.");
  const reason = typeof raw.reason === "string" ? raw.reason.trim().replace(/\s+/g, " ") : "";
  if (reason.length > MAX_REASON_LENGTH)
    fail(`El motivo admite como máximo ${MAX_REASON_LENGTH} caracteres.`);
  if (type === "ajuste" && reason.length < 3) fail("El ajuste necesita un motivo.");
  return {
    inventory_item_id: inventoryItemId,
    location_id: locationId,
    type,
    quantity,
    reason: reason || null,
  };
}

export type MovementEffect = { delta: number; before: number; after: number };

/**
 * Applies a movement to the current stocked quantity. The resulting stock can
 * never drop below the units already reserved by orders.
 */
export function applyMovement(
  input: Pick<MovementInput, "type" | "quantity">,
  current: { stocked: number; reserved: number },
): MovementEffect {
  const before = Math.max(0, Math.trunc(current.stocked));
  const reserved = Math.max(0, Math.trunc(current.reserved));
  const after =
    input.type === "alta"
      ? before + input.quantity
      : input.type === "ajuste"
        ? input.quantity
        : before - input.quantity;
  if (after === before) fail("El stock contado coincide con el actual; no hay nada que ajustar.");
  if (after < 0) fail(`No hay suficiente stock: hay ${before} unidades.`);
  if (after < reserved) {
    fail(`No puede quedar menos stock que las ${reserved} unidades reservadas por pedidos.`);
  }
  return { delta: after - before, before, after };
}

export type MovementFilters = {
  inventory_item_id?: string;
  location_id?: string;
  type?: MovementType;
  actor_id?: string;
  from?: Date;
  to?: Date;
};

/** Parses list/export query strings. Unknown or invalid values are rejected, not ignored. */
export function parseMovementFilters(query: Record<string, unknown>): MovementFilters {
  const text = (key: string) => {
    const value = query[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const date = (key: string) => {
    const value = text(key);
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) fail(`La fecha «${key}» no es válida.`);
    return parsed;
  };
  const type = text("type");
  if (type && !MOVEMENT_TYPES.includes(type as MovementType))
    fail("El tipo de movimiento no es válido.");
  const filters: MovementFilters = {
    inventory_item_id: text("inventory_item_id"),
    location_id: text("location_id"),
    type: type as MovementType | undefined,
    actor_id: text("actor_id"),
    from: date("from"),
    to: date("to"),
  };
  if (filters.from && filters.to && filters.from > filters.to)
    fail("La fecha inicial es posterior a la final.");
  return filters;
}

export type MovementRow = {
  created_at: string | Date;
  type: MovementType;
  title: string | null;
  sku: string | null;
  location_name: string | null;
  delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  actor_email: string | null;
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  alta: "Alta",
  baja: "Baja",
  venta: "Venta",
  ajuste: "Ajuste",
};

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  // Neutralise spreadsheet formulas and quote separators, quotes and line breaks.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d+$/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV for spreadsheets in Spanish locales: `;` separator, UTF-8 BOM so Excel
 * keeps accents, ISO dates in UTC.
 */
export function movementsToCsv(rows: MovementRow[]): string {
  const header = [
    "Fecha (UTC)",
    "Tipo",
    "Producto",
    "SKU",
    "Ubicación",
    "Cambio",
    "Antes",
    "Después",
    "Motivo",
    "Usuario",
  ];
  const lines = rows.map((row) =>
    [
      new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19),
      MOVEMENT_TYPE_LABELS[row.type],
      row.title,
      row.sku,
      row.location_name,
      row.delta > 0 ? `+${row.delta}` : String(row.delta),
      row.quantity_before,
      row.quantity_after,
      row.reason,
      row.actor_email,
    ]
      .map(csvCell)
      .join(";"),
  );
  return `\uFEFF${[header.join(";"), ...lines].join("\r\n")}\r\n`;
}
