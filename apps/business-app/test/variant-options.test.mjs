import assert from "node:assert/strict";
import test from "node:test";
import {
  canAddDefaultVariant,
  deriveVariantAxes,
  hasVariantCombination,
} from "../lib/variant-options.ts";

test("derives sorted option axes and unique values from existing variants", () => {
  const axes = deriveVariantAxes([
    {
      options: [
        { value: "M", option: { title: "Talla" } },
        { value: "Azul", option: { title: "Color" } },
      ],
    },
    {
      options: [
        { value: "S", option: { title: "Talla" } },
        { value: "Azul", option: { title: "Color" } },
      ],
    },
  ]);

  assert.deepEqual(axes, [
    { title: "Color", values: ["Azul"] },
    { title: "Talla", values: ["M", "S"] },
  ]);
});

test("detects an existing combination independent of option order", () => {
  const variants = [
    {
      options: [
        { value: "Azul", option: { title: "Color" } },
        { value: "M", option: { title: "Talla" } },
      ],
    },
  ];

  assert.equal(hasVariantCombination(variants, { Talla: "M", Color: "Azul" }), true);
  assert.equal(hasVariantCombination(variants, { Talla: "S", Color: "Azul" }), false);
});

test("allows one default variant only when a product has no variants", () => {
  assert.equal(canAddDefaultVariant([]), true);
  assert.equal(canAddDefaultVariant([{ options: [] }]), false);
});
