/**
 * Deterministic title/description drafts from the product sheet (ported from the legacy
 * catalog's AI-01 assistant). It only rearranges facts the seller entered: it never invents
 * specifications. The AI Studio (AG-27) builds on top of it, not instead of it.
 */
export type ProductSpecifications = Record<string, string>;

export type ProductCopyTone = "commercial" | "technical" | "direct";

function formatSpecificationValue(value: string, unit?: string): string {
  const normalized = value.trim();
  const suffix = unit?.trim();
  if (!suffix) return normalized;
  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\s*${escapedSuffix}$`, "i").test(normalized)) return normalized;
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(normalized)) return `${normalized} ${suffix}`;
  return normalized;
}

export function buildProductTitleDraft(input: { name: string; brand?: string }): string {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return "";

  const brand = input.brand?.trim().replace(/\s+/g, " ");
  const includesBrand = brand && name.toLocaleLowerCase().includes(brand.toLocaleLowerCase());
  const title = brand && !includesBrand ? `${brand} ${name}` : name;
  if (title.length <= 120) return title;
  return `${title.slice(0, 117).trimEnd()}…`;
}

export function buildProductCopyDraft(input: {
  name: string;
  brand?: string;
  category?: string;
  specifications?: ProductSpecifications;
  fieldUnits?: Record<string, string>;
  detail?: "brief" | "complete";
  tone?: ProductCopyTone;
  additionalNote?: string;
}): string {
  const name = input.name.trim();
  if (!name) return "";

  const basicFacts: string[] = [];
  const specificationFacts: string[] = [];
  const maxLength = 4900;
  const addFact = (target: string[], label: string, value?: string, unit?: string) => {
    const normalized = value?.trim() ? formatSpecificationValue(value, unit) : "";
    if (!normalized) return;
    const fact = `${label}: ${normalized}`;
    const currentLength =
      name.length +
      2 +
      [...basicFacts, ...specificationFacts].reduce((total, item) => total + item.length + 2, 0);
    if (currentLength + fact.length <= maxLength) target.push(fact);
  };

  addFact(basicFacts, "Marca", input.brand);
  addFact(basicFacts, "Categoría", input.category);

  const specificationEntries = Object.entries(input.specifications ?? {}).filter(([, value]) =>
    value.trim(),
  );
  const selectedSpecificationEntries =
    input.detail === "brief" ? specificationEntries.slice(0, 2) : specificationEntries;
  for (const [label, value] of selectedSpecificationEntries) {
    addFact(specificationFacts, label, value, input.fieldUnits?.[label]);
  }

  const facts = [...basicFacts, ...specificationFacts];
  const note = input.additionalNote?.trim();
  const currentLength = name.length + 2 + facts.reduce((total, item) => total + item.length + 2, 0);
  const safeNote = note && currentLength + note.length <= maxLength ? note : "";

  if (input.tone === "technical") {
    return [name, ...facts, ...(safeNote ? [safeNote] : [])].join("\n");
  }

  if (input.tone === "direct") {
    const conciseFacts = [...basicFacts, ...specificationFacts.slice(0, 3)];
    const draft = [name, ...conciseFacts].join(". ");
    return safeNote ? `${draft}. ${safeNote}` : `${draft}.`;
  }

  const factText = facts.length ? `${name}. ${facts.join(". ")}.` : `${name}.`;
  return safeNote ? `${factText} ${safeNote}` : factText;
}
