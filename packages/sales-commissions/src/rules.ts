/**
 * Pure commission rules for AgeStyles sales agents (AG-06), shared by the
 * Commerce API and its tests. Decisions recorded in
 * docs/design/AG-06-gestores-y-comisiones.md:
 * - a product's own rule wins; the store's general rule covers the rest;
 * - a fixed rule may require a cumulative unit threshold (legacy behaviour);
 * - the agent's balance is an append-only ledger and never goes negative.
 */

export const RULE_KINDS = ["percent", "fixed"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const MAX_PERCENT = 100;
export const MAX_FIXED = 100_000;
export const MAX_THRESHOLD = 10_000;

export class CommissionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommissionValidationError";
  }
}

function fail(message: string): never {
  throw new CommissionValidationError(message);
}

/** Money with two decimals, avoiding floating-point residue. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type CommissionRuleInput = {
  product_id: string | null;
  kind: RuleKind;
  value: number;
  unit_threshold: number | null;
};

export function parseRuleInput(body: unknown): CommissionRuleInput {
  if (!body || typeof body !== "object") fail("Faltan los datos de la regla de comisión.");
  const raw = body as Record<string, unknown>;
  const productId =
    typeof raw.product_id === "string" && raw.product_id.trim() ? raw.product_id.trim() : null;
  if (typeof raw.kind !== "string" || !RULE_KINDS.includes(raw.kind as RuleKind)) {
    fail("El tipo de comisión debe ser porcentaje o importe fijo.");
  }
  const kind = raw.kind as RuleKind;
  const value = typeof raw.value === "string" ? Number(raw.value) : raw.value;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail("La comisión debe ser mayor que cero.");
  }
  if (kind === "percent" && value > MAX_PERCENT) fail("El porcentaje no puede superar el 100 %.");
  if (kind === "fixed" && value > MAX_FIXED) fail("El importe de comisión es demasiado alto.");
  if (roundMoney(value) !== value) fail("La comisión admite como máximo dos decimales.");
  let threshold: number | null = null;
  if (
    raw.unit_threshold !== undefined &&
    raw.unit_threshold !== null &&
    raw.unit_threshold !== ""
  ) {
    const parsed =
      typeof raw.unit_threshold === "string" ? Number(raw.unit_threshold) : raw.unit_threshold;
    if (
      typeof parsed !== "number" ||
      !Number.isSafeInteger(parsed) ||
      parsed < 2 ||
      parsed > MAX_THRESHOLD
    ) {
      fail("El umbral acumulable debe ser un número entero de unidades entre 2 y 10.000.");
    }
    if (kind !== "fixed") fail("El umbral acumulable solo se usa con comisión de importe fijo.");
    if (!productId) fail("El umbral acumulable se define por producto, no en la regla general.");
    threshold = parsed;
  }
  return { product_id: productId, kind, value, unit_threshold: threshold };
}

export type CommissionRule = CommissionRuleInput & { id?: string };

/** The product's own rule wins; otherwise the store-wide rule; otherwise none. */
export function resolveRule(rules: CommissionRule[], productId: string): CommissionRule | null {
  return (
    rules.find((rule) => rule.product_id === productId) ??
    rules.find((rule) => rule.product_id === null) ??
    null
  );
}

export type CommissionLine = {
  product_id: string;
  quantity: number;
  /** Unit price actually charged, in the sale currency. */
  unit_price: number;
};

export type LineCommission = {
  product_id: string;
  rule_id: string | null;
  units: number;
  amount: number;
};

/**
 * Commission earned by one sold line. `unitsBefore` is how many units of the
 * product the agent had already sold towards a cumulative threshold; with a
 * threshold N, the fixed amount is earned once for every N units completed.
 */
export function commissionForLine(
  rule: CommissionRule | null,
  line: CommissionLine,
  unitsBefore = 0,
): LineCommission {
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1)
    fail("Cantidad de línea no válida.");
  if (!Number.isFinite(line.unit_price) || line.unit_price < 0) fail("Precio de línea no válido.");
  const base = { product_id: line.product_id, rule_id: rule?.id ?? null, units: line.quantity };
  if (!rule) return { ...base, amount: 0 };
  if (rule.kind === "percent") {
    return { ...base, amount: roundMoney((line.unit_price * line.quantity * rule.value) / 100) };
  }
  if (!rule.unit_threshold) return { ...base, amount: roundMoney(rule.value * line.quantity) };
  const before = Math.max(0, Math.trunc(unitsBefore));
  const blocks =
    Math.floor((before + line.quantity) / rule.unit_threshold) -
    Math.floor(before / rule.unit_threshold);
  return { ...base, amount: roundMoney(blocks * rule.value) };
}

/** Units still needed to earn the next cumulative commission (for the agent's progress view). */
export function unitsToNextThreshold(
  rule: CommissionRule | null,
  unitsSoFar: number,
): number | null {
  if (!rule?.unit_threshold) return null;
  const done = Math.max(0, Math.trunc(unitsSoFar)) % rule.unit_threshold;
  return rule.unit_threshold - done;
}

export const ENTRY_KINDS = ["earned", "reversed", "withdrawn"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** Balance of an agent's append-only ledger: earned minus reversals and withdrawals. */
export function ledgerBalance(entries: { kind: EntryKind; amount: number }[]): number {
  return roundMoney(
    entries.reduce((sum, entry) => {
      const amount = Math.abs(Number(entry.amount));
      return entry.kind === "earned" ? sum + amount : sum - amount;
    }, 0),
  );
}

/** A withdrawal request must be positive, have two decimals and fit in the balance. */
export function validateWithdrawal(amount: unknown, available: number): number {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail("Indica un importe a retirar mayor que cero.");
  }
  if (roundMoney(value) !== value) fail("El importe admite como máximo dos decimales.");
  if (value > roundMoney(available)) {
    fail(`El saldo disponible es ${roundMoney(available).toFixed(2)}; no se puede retirar más.`);
  }
  return value;
}

export const PAYMENT_METHODS = ["cash", "transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Agent codes buyers can type or receive in a link: 4–12 letters or digits, case-insensitive. */
export function normalizeAgentCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const normalized = code.trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(normalized) ? normalized : null;
}

export type AgentSaleInput = {
  location_id: string;
  payment_method: PaymentMethod;
  note: string | null;
  lines: { offer_id: string; quantity: number; unit_price: number }[];
};

export const MAX_SALE_LINES = 50;

/** Sale registered by an agent in Negocio (shop, WhatsApp…); stock leaves the given location. */
export function parseAgentSaleInput(body: unknown): AgentSaleInput {
  if (!body || typeof body !== "object") fail("Faltan los datos de la venta.");
  const raw = body as Record<string, unknown>;
  const locationId = typeof raw.location_id === "string" ? raw.location_id.trim() : "";
  if (!locationId) fail("Elige la ubicación de la que sale la mercancía.");
  if (
    typeof raw.payment_method !== "string" ||
    !PAYMENT_METHODS.includes(raw.payment_method as PaymentMethod)
  ) {
    fail("La forma de pago debe ser efectivo o transferencia.");
  }
  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, 300) : "";
  if (!Array.isArray(raw.lines) || !raw.lines.length)
    fail("Añade al menos un producto a la venta.");
  if (raw.lines.length > MAX_SALE_LINES)
    fail(`Una venta admite como máximo ${MAX_SALE_LINES} líneas.`);
  const lines = raw.lines.map((line) => {
    if (!line || typeof line !== "object") fail("Línea de venta no válida.");
    const row = line as Record<string, unknown>;
    const offerId = typeof row.offer_id === "string" ? row.offer_id.trim() : "";
    const quantity = typeof row.quantity === "string" ? Number(row.quantity) : row.quantity;
    const price = typeof row.unit_price === "string" ? Number(row.unit_price) : row.unit_price;
    if (!offerId) fail("Cada línea necesita un producto.");
    if (
      typeof quantity !== "number" ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 10_000
    ) {
      fail("La cantidad de cada línea debe ser un entero entre 1 y 10.000.");
    }
    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0 ||
      roundMoney(price) !== price
    ) {
      fail("El precio de cada línea debe ser un importe válido con dos decimales como máximo.");
    }
    return { offer_id: offerId, quantity, unit_price: price };
  });
  if (new Set(lines.map((line) => line.offer_id)).size !== lines.length) {
    fail("Un producto solo puede aparecer una vez en la venta.");
  }
  return {
    location_id: locationId,
    payment_method: raw.payment_method as PaymentMethod,
    note: note || null,
    lines,
  };
}
