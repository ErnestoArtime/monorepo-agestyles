export type VariantOptionValue = {
  value: string;
  option?: { title?: string | null } | null;
};

export type VariantOptionSource = { options?: VariantOptionValue[] | null };
export type VariantAxis = { title: string; values: string[] };

export function deriveVariantAxes(variants: VariantOptionSource[]): VariantAxis[] {
  const valuesByAxis = new Map<string, Set<string>>();
  for (const variant of variants) {
    for (const option of variant.options ?? []) {
      const title = option.option?.title?.trim();
      const value = option.value?.trim();
      if (!title || !value) continue;
      const values = valuesByAxis.get(title) ?? new Set<string>();
      values.add(value);
      valuesByAxis.set(title, values);
    }
  }

  return [...valuesByAxis.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, values]) => ({
      title,
      values: [...values].sort((left, right) => left.localeCompare(right)),
    }));
}

function combinationKey(options: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(options).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function hasVariantCombination(
  variants: VariantOptionSource[],
  options: Record<string, string>,
): boolean {
  const expectedKey = combinationKey(options);
  return variants.some((variant) => {
    const existing = Object.fromEntries(
      (variant.options ?? [])
        .filter((option) => option.option?.title && option.value)
        .map((option) => [option.option!.title!, option.value]),
    );
    return combinationKey(existing) === expectedKey;
  });
}

/** Products without option axes can have at most one indistinguishable default variant. */
export function canAddDefaultVariant(variants: VariantOptionSource[]): boolean {
  return variants.length === 0;
}
