import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useBusiness } from "../context/business-context";
import { hasPermission, Section } from "../components/operation-list";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { parseCatalogCsv, type CatalogCsvRow } from "../lib/catalog-csv";

type SellerVariant = { id: string; title?: string; sku?: string | null };
type SellerProduct = {
  id: string;
  title?: string;
  description?: string | null;
  variants?: SellerVariant[];
};
type CatalogResponse = { products?: SellerProduct[]; count?: number; limit?: number };
type PreviewRow = {
  row: CatalogCsvRow;
  action: "crear" | "actualizar";
  product?: SellerProduct;
  variant?: SellerVariant;
  error?: string;
};

const CSV_TEMPLATE =
  "sku;titulo;descripcion;variante\nCAMISA-001;Camisa AgeStyles;Camisa de algodón;Talla M";

export default function CatalogImportScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { request, seller, member } = useBusiness();
  const canEdit = hasPermission(member, "products", "edit");
  const [csvText, setCsvText] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function loadSellerProducts(): Promise<SellerProduct[]> {
    const products: SellerProduct[] = [];
    let offset = 0;
    const limit = 100;
    let count = 0;
    do {
      const page = await request<CatalogResponse>(
        `/vendor/products?offset=${offset}&limit=${limit}&fields=id,title,description,variants.id,variants.title,variants.sku`,
      );
      products.push(...(page.products ?? []));
      count = page.count ?? products.length;
      if (!page.products?.length) break;
      offset += page.products.length;
    } while (offset < count && offset < 5000);
    return products;
  }

  async function createPreview() {
    setError("");
    setResults([]);
    setPreviewRows([]);
    const parsed = parseCatalogCsv(csvText);
    setValidationErrors(parsed.errors);
    if (parsed.errors.length) return;
    if (!seller) {
      setError("Selecciona primero una tienda.");
      return;
    }
    if (parsed.rows.length > 200) {
      setValidationErrors(["El archivo supera el máximo de 200 filas por importación."]);
      return;
    }

    setPreviewing(true);
    try {
      const products = await loadSellerProducts();
      const seenProducts = new Set<string>();
      const rows = parsed.rows.map<PreviewRow>((row) => {
        let product: SellerProduct | undefined;
        let variant: SellerVariant | undefined;
        if (row.productId) {
          product = products.find((candidate) => candidate.id === row.productId);
          if (!product) {
            return {
              row,
              action: "actualizar",
              error: "El product_id no pertenece a esta tienda o no existe.",
            };
          }
          if (row.sku) {
            const matches =
              product.variants?.filter(
                (candidate) =>
                  candidate.sku?.toLocaleLowerCase("es-ES") === row.sku.toLocaleLowerCase("es-ES"),
              ) ?? [];
            if (matches.length !== 1) {
              return {
                row,
                action: "actualizar",
                product,
                error: "El SKU no pertenece al product_id indicado.",
              };
            }
            variant = matches[0];
          }
        } else {
          const matches = products.flatMap((candidate) =>
            (candidate.variants ?? [])
              .filter(
                (item) =>
                  item.sku?.toLocaleLowerCase("es-ES") === row.sku.toLocaleLowerCase("es-ES"),
              )
              .map((item) => ({ product: candidate, variant: item })),
          );
          if (matches.length > 1) {
            return {
              row,
              action: "actualizar",
              error: "El SKU aparece en más de un producto; identifica el product_id.",
            };
          }
          if (matches.length === 1) {
            product = matches[0].product;
            variant = matches[0].variant;
          }
        }

        if (!product && !row.title.trim()) {
          return {
            row,
            action: "crear",
            error: "Para crear un producto, el título es obligatorio.",
          };
        }
        if (product && seenProducts.has(product.id)) {
          return {
            row,
            action: "actualizar",
            product,
            variant,
            error: "El producto aparece en más de una fila; usa una sola fila por producto.",
          };
        }
        if (product) seenProducts.add(product.id);
        return { row, action: product ? "actualizar" : "crear", product, variant };
      });
      setPreviewRows(rows);
      setValidationErrors(
        rows
          .filter((entry) => entry.error)
          .map((entry) => `Fila ${entry.row.rowNumber}: ${entry.error}`),
      );
    } catch {
      setError("No se pudo consultar el catálogo de esta tienda.");
    } finally {
      setPreviewing(false);
    }
  }

  async function applyImport() {
    if (!canEdit || !previewRows.length || validationErrors.length || applying) return;
    setApplying(true);
    setError("");
    setResults([]);
    const nextResults: string[] = [];
    for (const entry of previewRows) {
      const { row, product, variant } = entry;
      try {
        if (!product) {
          await request("/vendor/products", "POST", {
            title: row.title.trim(),
            ...(row.description ? { description: row.description } : {}),
            status: "proposed",
            variants: [{ title: row.variantTitle.trim() || "Única", sku: row.sku.trim() }],
          });
          nextResults.push(`Fila ${row.rowNumber}: ficha creada y enviada a revisión.`);
          continue;
        }

        const productUpdate: { title?: string; description?: string } = {};
        const title = row.title.trim();
        if (title && title !== product.title) productUpdate.title = title;
        if (row.description && row.description !== (product.description ?? "")) {
          productUpdate.description = row.description;
        }
        let changed = false;
        if (Object.keys(productUpdate).length) {
          await request(`/vendor/products/${product.id}`, "POST", productUpdate);
          changed = true;
        }
        if (
          variant &&
          row.variantTitle.trim() &&
          row.variantTitle.trim() !== (variant.title ?? "")
        ) {
          await request(`/vendor/products/${product.id}/variants/${variant.id}`, "POST", {
            title: row.variantTitle.trim(),
          });
          changed = true;
        }
        nextResults.push(
          changed
            ? `Fila ${row.rowNumber}: corrección enviada a revisión.`
            : `Fila ${row.rowNumber}: sin cambios; los datos ya coinciden.`,
        );
      } catch {
        nextResults.push(
          `Fila ${row.rowNumber}: no se pudo procesar. Revisa si alguna corrección quedó enviada a revisión.`,
        );
      }
      setResults([...nextResults]);
    }
    setResults(nextResults);
    setApplying(false);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.back}>‹ Volver a productos</Text>
      </Pressable>
      <Text style={styles.title}>Importar catálogo por CSV</Text>
      <Text style={styles.subtitle}>
        Pega el contenido del archivo. Usa una fila por producto; cada alta debe incluir un SKU
        único.
      </Text>

      {!canEdit ? (
        <Text style={styles.error}>Tu rol no permite importar ni corregir productos.</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Section title="Formato de columnas">
        <Text style={styles.body}>
          Obligatorias: sku y titulo para altas. Opcionales: product_id, descripcion y variante. Se
          aceptan comas, punto y coma o tabuladores; los valores entre comillas pueden contener
          separadores y saltos de línea.
        </Text>
        <Text selectable style={styles.template}>
          {CSV_TEMPLATE}
        </Text>
      </Section>
      <Section title="Contenido CSV">
        <TextInput
          accessibilityLabel="Contenido del catálogo CSV"
          value={csvText}
          onChangeText={(value) => {
            setCsvText(value);
            setPreviewRows([]);
            setValidationErrors([]);
            setResults([]);
            setError("");
          }}
          multiline
          editable={canEdit && !applying}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Pega aquí el contenido del CSV"
          placeholderTextColor={theme.muted}
          style={styles.input}
        />
        <Pressable
          onPress={() => void createPreview()}
          disabled={!canEdit || !csvText.trim() || previewing || applying}
          accessibilityRole="button"
          style={[
            styles.button,
            (!canEdit || !csvText.trim() || previewing || applying) && styles.disabled,
          ]}
        >
          <Text style={styles.buttonText}>
            {previewing ? "Validando…" : "Validar y previsualizar"}
          </Text>
        </Pressable>
      </Section>

      {validationErrors.length ? (
        <Section title="Corrige el CSV antes de importar">
          {validationErrors.map((message) => (
            <Text key={message} style={styles.error}>
              {message}
            </Text>
          ))}
        </Section>
      ) : null}
      {previewRows.length ? (
        <Section title={`Vista previa · ${previewRows.length} filas`}>
          {previewRows.map((entry) => (
            <View key={entry.row.rowNumber} style={styles.previewRow}>
              <Text style={styles.rowTitle}>
                {entry.action === "crear" ? "Nueva ficha" : "Corrección"} ·{" "}
                {entry.row.title || entry.product?.title || entry.row.sku}
              </Text>
              <Text style={styles.body}>
                Fila {entry.row.rowNumber} · SKU {entry.row.sku || "sin indicar"}
              </Text>
              {entry.error ? <Text style={styles.error}>{entry.error}</Text> : null}
            </View>
          ))}
          <Text style={styles.note}>
            Las altas y correcciones se envían al flujo de revisión de AgeStyles. Este CSV no define
            precio, oferta ni existencias; esos datos deben completarse antes de vender.
          </Text>
          <Pressable
            onPress={() => void applyImport()}
            disabled={!canEdit || !!validationErrors.length || applying}
            accessibilityRole="button"
            style={[styles.button, (validationErrors.length > 0 || applying) && styles.disabled]}
          >
            <Text style={styles.buttonText}>
              {applying ? "Importando…" : "Enviar filas a revisión"}
            </Text>
          </Pressable>
        </Section>
      ) : null}
      {results.length ? (
        <Section title="Resultado de importación">
          {results.map((result) => (
            <Text key={result} style={styles.body}>
              {result}
            </Text>
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: theme.background },
    content: { padding: 20, paddingBottom: 44, gap: 14 },
    back: { color: theme.action, fontSize: 15, fontWeight: "600", paddingVertical: 8 },
    title: { color: theme.text, fontSize: 27, fontWeight: "700" },
    subtitle: { color: theme.muted, fontSize: 15, lineHeight: 22 },
    body: { color: theme.text, fontSize: 14, lineHeight: 21 },
    template: {
      color: theme.text,
      backgroundColor: theme.surface,
      padding: 12,
      borderRadius: 10,
      fontFamily: "monospace",
    },
    input: {
      minHeight: 190,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      color: theme.text,
      backgroundColor: theme.surface,
      textAlignVertical: "top",
      fontFamily: "monospace",
    },
    button: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: theme.action,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      marginTop: 12,
    },
    buttonText: { color: theme.onAction, fontSize: 15, fontWeight: "700" },
    disabled: { opacity: 0.45 },
    previewRow: {
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingVertical: 10,
      gap: 3,
    },
    rowTitle: { color: theme.text, fontSize: 15, fontWeight: "600" },
    error: { color: theme.error, fontSize: 14, lineHeight: 20 },
    note: { color: theme.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  });
