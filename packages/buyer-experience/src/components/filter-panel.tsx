import { Icon } from "@agestyles/icons";
import { PillGroup, useUiTheme } from "@agestyles/ui-native";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

export type CatalogSort = "featured" | "price_asc" | "price_desc" | "newest";

export type CatalogFilters = {
  sort: CatalogSort;
  category: string | null;
  minPrice: string;
  maxPrice: string;
  color: string | null;
  size: string | null;
  brand: string | null;
};

export const EMPTY_FILTERS: CatalogFilters = {
  sort: "featured",
  category: null,
  minPrice: "",
  maxPrice: "",
  color: null,
  size: null,
  brand: null,
};

/** How many criteria differ from the defaults (for the «Filtros» badge). */
export function activeFilterCount(filters: CatalogFilters): number {
  return [
    filters.sort !== "featured",
    Boolean(filters.category),
    Boolean(filters.minPrice.trim()),
    Boolean(filters.maxPrice.trim()),
    Boolean(filters.color),
    Boolean(filters.size),
    Boolean(filters.brand),
  ].filter(Boolean).length;
}

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "featured", label: "Destacados" },
  { value: "newest", label: "Novedades" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];

function parsePrice(value: string): number | null {
  const parsed = Number(value.replace(",", ".").trim());
  return value.trim() && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function priceBounds(filters: CatalogFilters) {
  return { min: parsePrice(filters.minPrice), max: parsePrice(filters.maxPrice) };
}

function PriceField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const { color } = useUiTheme();
  // Steppers move by 1 USD, as in the legacy catalog; the field accepts cents typed by hand.
  const step = (delta: number) => {
    const current = parsePrice(value) ?? 0;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    onChange(next ? String(next) : "");
  };
  return (
    <View style={styles.priceField}>
      <Text style={[styles.priceLabel, { color: color.muted }]}>{label}</Text>
      <View style={[styles.stepper, { borderColor: color.border, backgroundColor: color.surface }]}>
        <Pressable
          onPress={() => step(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Bajar ${label.toLowerCase()}`}
          style={styles.stepButton}
        >
          <Icon name="minus" size={16} color={color.text} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={color.muted}
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel={`Precio ${label.toLowerCase()} en USD`}
          style={[styles.priceInput, { color: color.text }]}
        />
        <Pressable
          onPress={() => step(1)}
          accessibilityRole="button"
          accessibilityLabel={`Subir ${label.toLowerCase()}`}
          style={styles.stepButton}
        >
          <Icon name="plus" size={16} color={color.text} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Catalog filters in a panel that slides in from the right, like the legacy catalog's
 * «Filtros»: order, category, price in USD and colour. Changes apply as they are made; the
 * footer shows how many products match.
 */
export function FilterPanel({
  visible,
  filters,
  onChange,
  onClose,
  categories,
  colors,
  sizes = [],
  brands = [],
  maxPriceHint,
  resultCount,
}: {
  visible: boolean;
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onClose: () => void;
  categories: { value: string; label: string }[];
  colors: string[];
  /** Sizes and brands of the products in view (codificadores, AG-42/43). */
  sizes?: string[];
  brands?: string[];
  maxPriceHint: number;
  resultCount: number;
}) {
  const { color } = useUiTheme();
  const { width } = useWindowDimensions();
  const set = (patch: Partial<CatalogFilters>) => onChange({ ...filters, ...patch });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.host}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar filtros"
        />
        <View
          accessibilityViewIsModal
          style={[styles.panel, { width: Math.min(420, width), backgroundColor: color.surface }]}
        >
          <View style={[styles.header, { borderBottomColor: color.border }]}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={[styles.title, { color: color.text }]}>
                Filtrar productos
              </Text>
              <Text style={[styles.subtitle, { color: color.muted }]}>
                Encuentra lo que necesitas
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar filtros"
              hitSlop={10}
              style={styles.close}
            >
              <Icon name="close" size={22} color={color.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.section}>
              <Text style={[styles.heading, { color: color.text }]}>Ordenar por</Text>
              <PillGroup
                accessibilityLabel="Ordenar por"
                value={filters.sort}
                onChange={(value) => set({ sort: value as CatalogSort })}
                options={SORTS}
              />
            </View>

            {categories.length ? (
              <View style={styles.section}>
                <Text style={[styles.heading, { color: color.text }]}>Categoría</Text>
                <PillGroup
                  accessibilityLabel="Categoría"
                  value={filters.category ?? "__all__"}
                  onChange={(value) =>
                    set({ category: value === "__all__" ? null : value, color: null })
                  }
                  options={[{ value: "__all__", label: "Todas" }, ...categories]}
                />
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.heading, { color: color.text }]}>Precio (USD)</Text>
              <View style={styles.priceRow}>
                <PriceField
                  label="Mínimo"
                  value={filters.minPrice}
                  placeholder="0"
                  onChange={(minPrice) => set({ minPrice })}
                />
                <PriceField
                  label="Máximo"
                  value={filters.maxPrice}
                  placeholder={String(Math.ceil(maxPriceHint) || "")}
                  onChange={(maxPrice) => set({ maxPrice })}
                />
              </View>
            </View>

            {colors.length ? (
              <View style={styles.section}>
                <Text style={[styles.heading, { color: color.text }]}>Color</Text>
                <PillGroup
                  accessibilityLabel="Color"
                  value={filters.color ?? "__all__"}
                  onChange={(value) => set({ color: value === "__all__" ? null : value })}
                  options={[
                    { value: "__all__", label: "Todos" },
                    ...colors.map((value) => ({ value, label: value })),
                  ]}
                />
              </View>
            ) : null}
            {sizes.length ? (
              <View style={styles.section}>
                <Text style={[styles.heading, { color: color.text }]}>Talla</Text>
                <PillGroup
                  accessibilityLabel="Talla"
                  value={filters.size ?? "__all__"}
                  onChange={(value) => set({ size: value === "__all__" ? null : value })}
                  options={[
                    { value: "__all__", label: "Todas" },
                    ...sizes.map((value) => ({ value, label: value })),
                  ]}
                />
              </View>
            ) : null}
            {brands.length ? (
              <View style={styles.section}>
                <Text style={[styles.heading, { color: color.text }]}>Marca</Text>
                <PillGroup
                  accessibilityLabel="Marca"
                  value={filters.brand ?? "__all__"}
                  onChange={(value) => set({ brand: value === "__all__" ? null : value })}
                  options={[
                    { value: "__all__", label: "Todas" },
                    ...brands.map((value) => ({ value, label: value })),
                  ]}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: color.border }]}>
            <Pressable
              onPress={() => onChange(EMPTY_FILTERS)}
              accessibilityRole="button"
              style={[styles.secondary, { borderColor: color.border }]}
            >
              <Text style={[styles.secondaryText, { color: color.text }]}>Restablecer filtros</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={[styles.primary, { backgroundColor: color.action }]}
            >
              <Text style={[styles.primaryText, { color: color.onAction }]}>
                {resultCount === 1 ? "Ver 1 producto" : `Ver ${resultCount} productos`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  panel: { height: "100%", maxWidth: "100%" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 4 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  body: { padding: 20, gap: 24 },
  section: { gap: 10 },
  heading: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  priceRow: { flexDirection: "row", gap: 12 },
  priceField: { flex: 1, gap: 6 },
  priceLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 46,
  },
  stepButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  priceInput: { flex: 1, minWidth: 0, textAlign: "center", fontSize: 16, paddingVertical: 8 },
  footer: { padding: 20, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  secondary: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontSize: 15, fontWeight: "600" },
  primary: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 15, fontWeight: "700" },
});
