import assert from "node:assert/strict";
import { buildProductCopyDraft, buildProductTitleDraft } from "../src/product-copy.ts";

assert.equal(
  buildProductTitleDraft({ name: "Camiseta deportiva", brand: "Nike" }),
  "Nike Camiseta deportiva",
);
assert.equal(buildProductTitleDraft({ name: "Nike Air", brand: "nike" }), "Nike Air");
assert.equal(buildProductTitleDraft({ name: "  " }), "");
assert.equal(buildProductTitleDraft({ name: "x".repeat(130) }).length, 118);

const sheet = {
  name: "Pantalón corto",
  brand: "Adidas",
  category: "Ropa",
  specifications: { Talla: "M", Peso: "200", Color: "Negro" },
  fieldUnits: { Peso: "g" },
};
assert.equal(
  buildProductCopyDraft(sheet),
  "Pantalón corto. Marca: Adidas. Categoría: Ropa. Talla: M. Peso: 200 g. Color: Negro.",
);
assert.equal(
  buildProductCopyDraft({ ...sheet, detail: "brief", tone: "technical" }),
  "Pantalón corto\nMarca: Adidas\nCategoría: Ropa\nTalla: M\nPeso: 200 g",
);
assert.equal(
  buildProductCopyDraft({ ...sheet, tone: "direct", additionalNote: "Lavar en frío" }),
  "Pantalón corto. Marca: Adidas. Categoría: Ropa. Talla: M. Peso: 200 g. Color: Negro. Lavar en frío",
);
assert.equal(buildProductCopyDraft({ name: "" }), "");
console.log("product-copy: ok");
