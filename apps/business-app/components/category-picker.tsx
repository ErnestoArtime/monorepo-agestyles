import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";

export type CategoryNode = { id: string; name: string; parent_category_id: string | null };

/** «Moda › Moda mujer»: a category with its parents, for choosing where something goes. */
export function categoryPath(categories: CategoryNode[], id: string | null | undefined): string {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const names: string[] = [];
  let current = id ? byId.get(id) : undefined;
  for (let depth = 0; current && depth < 8; depth += 1) {
    names.unshift(current.name);
    current = current.parent_category_id ? byId.get(current.parent_category_id) : undefined;
  }
  return names.join(" › ");
}

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Searchable list of categories shown with their path. `rootLabel` adds a first choice
 * meaning «no parent» (a main category).
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  rootLabel,
  label,
}: {
  categories: CategoryNode[];
  value: string | null;
  onChange: (id: string | null) => void;
  rootLabel?: string;
  label: string;
}) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const [query, setQuery] = useState("");
  const options = useMemo(
    () =>
      categories
        .map((category) => ({ id: category.id, path: categoryPath(categories, category.id) }))
        .sort((a, b) => a.path.localeCompare(b.path, "es")),
    [categories],
  );
  const filtered = options
    .filter((option) => !query.trim() || plain(option.path).includes(plain(query.trim())))
    .slice(0, 12);
  const chosen = value ? categoryPath(categories, value) : rootLabel;
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      {chosen ? <Text style={styles.chosen}>Elegida: {chosen}</Text> : null}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar categoría"
        placeholderTextColor={theme.muted}
        accessibilityLabel={`${label}: buscar`}
        style={styles.input}
      />
      {rootLabel ? (
        <Option text={rootLabel} selected={value === null} onPress={() => onChange(null)} />
      ) : null}
      {filtered.map((option) => (
        <Option
          key={option.id}
          text={option.path}
          selected={value === option.id}
          onPress={() => onChange(option.id)}
        />
      ))}
    </View>
  );
}

function Option({
  text,
  selected,
  onPress,
}: {
  text: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionOn]}
    >
      <Text style={styles.optionText}>{text}</Text>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    box: { gap: 6 },
    label: { color: theme.text, fontSize: 14, fontWeight: "600" },
    chosen: { color: theme.successText, fontSize: 13, fontWeight: "600" },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      color: theme.text,
      backgroundColor: theme.surface,
      fontSize: 15,
    },
    option: {
      minHeight: 40,
      paddingHorizontal: 12,
      justifyContent: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    optionOn: { borderColor: theme.action, backgroundColor: theme.quietSurface },
    optionText: { color: theme.text, fontSize: 14 },
  });
