/**
 * Codificadores (AG-42). Sizes and brands are Mercur global product attributes marked in
 * their metadata (`agestyles_codifier`), so the product form, the filters and the old
 * catalog's size types all read the same lists.
 */
export type AttributeValue = {
  id: string;
  name: string;
  rank?: number | null;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
};
export type Attribute = {
  id: string;
  name: string;
  type: string;
  is_active?: boolean;
  is_variant_axis?: boolean;
  product_id?: string | null;
  metadata?: Record<string, unknown> | null;
  values?: AttributeValue[];
};

export const CODIFIER_KEY = "agestyles_codifier";
export const ATTRIBUTE_FIELDS =
  "id,name,type,is_active,is_variant_axis,is_filterable,product_id,metadata,*values";

/** Size types of the old catalog (Codificadores → Tallas), with their preset sizes. */
export const SIZE_PRESETS: { type: string; name: string; values: string[] }[] = [
  {
    type: "calzado",
    name: "Talla de calzado",
    values: Array.from({ length: 19 }, (_, i) => String(5 + i / 2)),
  },
  { type: "pullovers", name: "Talla de pullover", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { type: "camiseta", name: "Talla de camiseta", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  { type: "shorts", name: "Talla de shorts", values: ["XS", "S", "M", "L", "XL", "XXL"] },
  {
    type: "pantalon",
    name: "Talla de pantalón",
    values: Array.from({ length: 11 }, (_, i) => String(24 + i)),
  },
];

export const isGlobal = (attribute: Attribute) => !attribute.product_id;
export const isSizeAttribute = (attribute: Attribute) =>
  isGlobal(attribute) && attribute.metadata?.[CODIFIER_KEY] === "size";
export const isBrandAttribute = (attribute: Attribute) =>
  isGlobal(attribute) && attribute.metadata?.[CODIFIER_KEY] === "brand";

export const activeValues = (attribute: Attribute) =>
  [...(attribute.values ?? [])]
    .filter((value) => value.is_active !== false)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, "es"));

export const sortedValues = (attribute: Attribute) =>
  [...(attribute.values ?? [])].sort(
    (a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, "es"),
  );

/** URL-safe handle from a Spanish name. */
export function handleFrom(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}
