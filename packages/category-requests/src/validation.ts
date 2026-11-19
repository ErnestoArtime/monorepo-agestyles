/** Rules for category requests, without Medusa (tested with plain Node). */

export class CategoryRequestValidationError extends Error {}

export type CategoryRequestInput = {
  name: string;
  description: string | null;
  suggested_parent_id: string | null;
  note: string | null;
};

export type CategoryDecision =
  | { action: "approve"; name: string; parent_id: string | null; note: string | null }
  | { action: "merge"; category_id: string; note: string | null }
  | { action: "reject"; note: string };

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : null;

const categoryId = (value: unknown) =>
  typeof value === "string" && /^pcat_[A-Za-z0-9]+$/.test(value) ? value : null;

export function validateCategoryRequestInput(raw: unknown): CategoryRequestInput {
  const body = (raw ?? {}) as Record<string, unknown>;
  const name = text(body.name, 60);
  if (!name || name.length < 2) {
    throw new CategoryRequestValidationError("Escribe el nombre de la categoría.");
  }
  if (
    body.suggested_parent_id != null &&
    body.suggested_parent_id !== "" &&
    !categoryId(body.suggested_parent_id)
  ) {
    throw new CategoryRequestValidationError("La categoría superior no es válida.");
  }
  return {
    name,
    description: text(body.description, 300),
    suggested_parent_id: categoryId(body.suggested_parent_id),
    note: text(body.note, 500),
  };
}

export function validateCategoryDecision(raw: unknown): CategoryDecision {
  const body = (raw ?? {}) as Record<string, unknown>;
  const note = text(body.note, 500);
  if (body.action === "approve") {
    const name = text(body.name, 60);
    if (!name || name.length < 2) {
      throw new CategoryRequestValidationError("Escribe el nombre de la categoría.");
    }
    if (body.parent_id != null && body.parent_id !== "" && !categoryId(body.parent_id)) {
      throw new CategoryRequestValidationError("La categoría superior no es válida.");
    }
    return { action: "approve", name, parent_id: categoryId(body.parent_id), note };
  }
  if (body.action === "merge") {
    const id = categoryId(body.category_id);
    if (!id) throw new CategoryRequestValidationError("Elige la categoría existente.");
    return { action: "merge", category_id: id, note };
  }
  if (body.action === "reject") {
    if (!note) throw new CategoryRequestValidationError("Escribe por qué no se acepta.");
    return { action: "reject", note };
  }
  throw new CategoryRequestValidationError("Decisión no válida.");
}

/** Category handle from its name: lowercase, without accents, words joined by hyphens. */
export function categoryHandle(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "categoria"
  );
}
