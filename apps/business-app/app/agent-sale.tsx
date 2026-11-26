import { ChipRow } from "@agestyles/ui-native";
import { Icon } from "@agestyles/icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../components/operation-list";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import { COMMISSIONS, commissionError, money } from "../lib/commissions";

type StoreOffer = {
  id: string;
  seller_id: string;
  product_id: string;
  sku?: string | null;
  product_variant?: { title?: string | null } | null;
  calculated_price?: { calculated_amount?: number | null } | null;
};
type Line = { offerId: string; title: string; quantity: string; price: string };

export default function AgentSaleScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { request, seller } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [locations, setLocations] = useState<{ id: string; name?: string }[]>([]);
  const [locationId, setLocationId] = useState("");
  const [payment, setPayment] = useState<"cash" | "transfer">("cash");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);

  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError("");
    try {
      const { regions } = await request<{ regions: { id: string }[] }>("/store/regions");
      const [offerData, productData, locationData] = await Promise.all([
        request<{ offers: StoreOffer[] }>(
          `/store/offers?limit=100&region_id=${regions[0]?.id ?? ""}&seller_id=${seller.id}&fields=%2Bcalculated_price`,
        ),
        request<{ products: { id: string; title?: string }[] }>(
          "/vendor/products?limit=100&fields=id,title",
        ),
        request<{ stock_locations: { id: string; name?: string }[] }>(
          "/vendor/stock-locations?limit=50&fields=id,name",
        ),
      ]);
      setOffers(offerData.offers.filter((offer) => offer.seller_id === seller.id));
      setTitles(
        new Map((productData.products ?? []).map((product) => [product.id, product.title ?? ""])),
      );
      setLocations(locationData.stock_locations ?? []);
      setLocationId((current) => current || locationData.stock_locations?.[0]?.id || "");
    } catch (cause) {
      setError(commissionError(cause, "No se pudieron cargar los productos de la tienda."));
    } finally {
      setLoading(false);
    }
  }, [request, seller]);

  useEffect(() => {
    void load();
  }, [load]);

  const titleOf = useCallback(
    (offer: StoreOffer) => {
      const product = titles.get(offer.product_id) || "Producto";
      const variant = offer.product_variant?.title;
      return variant && variant !== "Default" ? `${product} · ${variant}` : product;
    },
    [titles],
  );
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return offers
      .filter((offer) => !lines.some((line) => line.offerId === offer.id))
      .filter((offer) => `${titleOf(offer)} ${offer.sku ?? ""}`.toLowerCase().includes(text))
      .slice(0, 8);
  }, [lines, offers, query, titleOf]);
  const total = lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.price.replace(",", ".") || 0),
    0,
  );

  function update(offerId: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.offerId === offerId ? { ...line, ...patch } : line)),
    );
  }

  async function submit() {
    setError("");
    setResult("");
    if (!lines.length) {
      setError("Añade al menos un producto.");
      return;
    }
    setSaving(true);
    try {
      const data = await request<{ commission: number }>(COMMISSIONS.sales, "POST", {
        location_id: locationId,
        payment_method: payment,
        note: note.trim() || undefined,
        lines: lines.map((line) => ({
          offer_id: line.offerId,
          quantity: Number(line.quantity),
          unit_price: Number(line.price.replace(",", ".")),
        })),
      });
      setResult(
        data.commission > 0
          ? `Venta registrada. Comisión generada: ${money(data.commission)}.`
          : "Venta registrada. Esta venta aún no genera comisión.",
      );
      setLines([]);
      setNote("");
      await load();
    } catch (cause) {
      setError(commissionError(cause, "No se pudo registrar la venta."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <OperationList
      title="Registrar venta"
      subtitle="Anota una venta hecha en la tienda o por WhatsApp. El stock se descuenta y la comisión se suma a tu saldo."
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={styles.back}
      >
        <Icon name="arrowLeft" size={18} color={theme.action} />
        <Text style={styles.link}>Comisiones</Text>
      </Pressable>
      {result ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {result}
        </Text>
      ) : null}
      <Section title="Productos">
        <View style={styles.block}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Buscar producto"
            placeholder="Busca por nombre o SKU"
            placeholderTextColor={theme.placeholderText}
            style={styles.input}
          />
          {matches.map((offer) => (
            <Pressable
              key={offer.id}
              onPress={() => {
                setLines((current) => [
                  ...current,
                  {
                    offerId: offer.id,
                    title: titleOf(offer),
                    quantity: "1",
                    price: String(offer.calculated_price?.calculated_amount ?? ""),
                  },
                ]);
                setQuery("");
              }}
              accessibilityRole="button"
              style={styles.match}
            >
              <Icon name="plus" size={16} color={theme.action} />
              <Text style={styles.text}>{titleOf(offer)}</Text>
              <Text style={styles.muted}>{money(offer.calculated_price?.calculated_amount)}</Text>
            </Pressable>
          ))}
        </View>
        {lines.map((line) => (
          <View key={line.offerId} style={styles.line}>
            <Text style={[styles.text, styles.flex]}>{line.title}</Text>
            <TextInput
              value={line.quantity}
              onChangeText={(quantity) => update(line.offerId, { quantity })}
              keyboardType="number-pad"
              inputMode="numeric"
              accessibilityLabel={`Cantidad de ${line.title}`}
              style={[styles.input, styles.small]}
            />
            <TextInput
              value={line.price}
              onChangeText={(price) => update(line.offerId, { price })}
              keyboardType="decimal-pad"
              inputMode="decimal"
              accessibilityLabel={`Precio por unidad de ${line.title}`}
              style={[styles.input, styles.price]}
            />
            <Pressable
              onPress={() =>
                setLines((current) => current.filter((item) => item.offerId !== line.offerId))
              }
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${line.title}`}
              style={styles.remove}
            >
              <Icon name="minus" size={18} color={theme.error} />
            </Pressable>
          </View>
        ))}
      </Section>
      <Section title="Cobro">
        <View style={styles.block}>
          <View
            style={styles.chips}
            accessibilityRole="radiogroup"
            accessibilityLabel="Forma de pago"
          >
            {(["cash", "transfer"] as const).map((method) => {
              const selected = payment === method;
              return (
                <Pressable
                  key={method}
                  onPress={() => setPayment(method)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {method === "cash" ? "Efectivo" : "Transferencia"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {locations.length > 1 ? (
            <ChipRow accessibilityRole="radiogroup" accessibilityLabel="Almacén">
              {locations.map((location) => {
                const selected = locationId === location.id;
                return (
                  <Pressable
                    key={location.id}
                    onPress={() => setLocationId(location.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {location.name ?? "Almacén"}
                    </Text>
                  </Pressable>
                );
              })}
            </ChipRow>
          ) : null}
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={300}
            accessibilityLabel="Nota de la venta"
            placeholder="Nota (opcional): cliente, referencia…"
            placeholderTextColor={theme.placeholderText}
            style={styles.input}
          />
          <Text style={styles.total}>Total: {money(total)}</Text>
          <Pressable
            disabled={saving || !lines.length || !locationId}
            onPress={() => void submit()}
            accessibilityRole="button"
            style={[styles.primary, (saving || !lines.length || !locationId) && styles.disabled]}
          >
            <Text style={styles.primaryText}>{saving ? "Registrando…" : "Registrar venta"}</Text>
          </Pressable>
        </View>
      </Section>
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
    link: { color: theme.action, fontSize: 14, fontWeight: "500" },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    block: { padding: 14, gap: 8 },
    flex: { flex: 1 },
    text: { color: theme.text, fontSize: 14 },
    muted: { color: theme.muted, fontSize: 12 },
    total: { color: theme.text, fontSize: 17, fontWeight: "700", marginTop: 6 },
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
    small: { width: 56, textAlign: "center" },
    price: { width: 84, textAlign: "right" },
    match: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
    line: {
      minHeight: 60,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      justifyContent: "center",
    },
    chipSelected: { backgroundColor: theme.action, borderColor: theme.action },
    chipText: { color: theme.text, fontSize: 13 },
    chipTextSelected: { color: theme.onAction, fontWeight: "600" },
    primary: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: theme.action,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    primaryText: { color: theme.onAction, fontSize: 15, fontWeight: "600" },
    disabled: { opacity: 0.45 },
  });
