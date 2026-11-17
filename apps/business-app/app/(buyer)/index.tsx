import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBuyerCartFeature } from "../../../../packages/features-buyer/src/cart";
import { logoutBusinessBuyerActor } from "../../../../packages/features-buyer/src/business-buyer-session";
import { listProductOffers } from "../../../../packages/api-client/src/offers";
import {
  acceptOrderQuote,
  createOrderQuote,
} from "../../../../packages/api-client/src/order-quotes";
import { listStoreProducts } from "../../../../packages/api-client/src/store";
import { OperationList, Section } from "../../components/operation-list";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { buyerActorSession as buyer, buyerSdk } from "../../context/buyer-actor";

type Offer = {
  id: string;
  seller: { id: string; name: string };
  price: { amount: number; currency_code: string } | null;
};
type Region = { id: string; currency_code: string };
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(amount / 100);
const buyerCart = createBuyerCartFeature(
  buyerSdk.client,
  AsyncStorage,
  "agestyles.business.buyer.cart_id",
);
const buyerCatalog = {
  listProducts: (regionId: string, query?: string) =>
    listStoreProducts(buyerSdk.client, { regionId, query, limit: 30 }),
  listOffers: (productId: string, regionId: string) =>
    listProductOffers(buyerSdk.client, { productId, regionId }),
};
const buyerQuotes = {
  create: (cartId: string, idempotencyKey: string) =>
    createOrderQuote(buyerSdk.client, { cartId, idempotencyKey }),
  accept: (quoteId: string, revision: number) =>
    acceptOrderQuote(buyerSdk.client, quoteId, revision),
};
type BuyerCart = Awaited<ReturnType<typeof buyerCart.loadOrCreate>>;
type BuyerCustomer = NonNullable<Awaited<ReturnType<typeof buyer.getCustomer>>>;
type BuyerQuote = Awaited<ReturnType<typeof buyerQuotes.create>>["quote"];
type BuyerProduct = Awaited<ReturnType<typeof buyerCatalog.listProducts>>["products"][number];

export default function BuyerModeScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const [customer, setCustomer] = useState<BuyerCustomer | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState<Region | null>(null);
  const [products, setProducts] = useState<BuyerProduct[]>([]);
  const [offers, setOffers] = useState<Record<string, Offer[]>>({});
  const [cart, setCart] = useState<BuyerCart | null>(null);
  const [quote, setQuote] = useState<BuyerQuote | null>(null);
  const [orders, setOrders] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setError("");
    try {
      const session = await buyer.getCustomer();
      setCustomer(session);
      const result = await buyerSdk.client.fetch<{ regions: Region[] }>("/store/regions?limit=1");
      const selectedRegion = result.regions?.[0];
      if (!selectedRegion) throw new Error("No hay una región de compra configurada.");
      setRegion(selectedRegion);
      const [catalog, loadedCart] = await Promise.all([
        buyerCatalog.listProducts(selectedRegion.id, search || undefined),
        buyerCart.loadOrCreate(selectedRegion.id),
      ]);
      const currentCart = session ? await buyerCart.transfer(loadedCart.id) : loadedCart;
      setProducts(catalog.products);
      setCart(currentCart);
      setQuote(null);
      const productOffers = await Promise.all(
        catalog.products.map(async (product) => {
          const page = await buyerCatalog.listOffers(product.id, selectedRegion.id);
          return [
            product.id,
            page.offers
              .filter((offer) => offer.price)
              .map((offer) => ({ id: offer.id, seller: offer.seller, price: offer.price })),
          ] as const;
        }),
      );
      setOffers(Object.fromEntries(productOffers));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la tienda.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const result = await buyer.login(email.trim(), password);
      setCustomer(result.customer);
      await load(query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión de comprador.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await logoutBusinessBuyerActor(buyer, () => {
        setCustomer(null);
        setQuote(null);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cerrar la sesión de cliente.");
    } finally {
      setBusy(false);
    }
  }

  async function addOffer(offerId: string) {
    if (!region || !cart) return;
    setBusy(true);
    setError("");
    try {
      const updated = await buyerCart.addOffer(cart.id, offerId, 1);
      setCart(updated);
      setQuote(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo añadir la oferta.");
    } finally {
      setBusy(false);
    }
  }

  async function requestQuote() {
    if (!customer) {
      setError("Inicia sesión como cliente para solicitar una cotización.");
      return;
    }
    if (!cart?.items?.length) return;
    setBusy(true);
    setError("");
    try {
      const intentKey = cart.items
        .map((item) => `${item.id}:${item.quantity}`)
        .sort()
        .join("|");
      const result = await buyerQuotes.create(cart.id, `business-buyer-${cart.id}-${intentKey}`);
      setQuote(result.quote);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo solicitar la cotización.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptQuote() {
    if (!quote) return;
    setBusy(true);
    setError("");
    try {
      const result = await buyerQuotes.accept(quote.id, quote.revision);
      if (result.status === "accepted") {
        setOrders(result.orders.map((order) => order.id));
        setCart((await buyerCart.clear(region?.id)) as BuyerCart);
        setQuote(null);
      } else if ("quote" in result) setQuote(result.quote);
      else setError(`La cotización no se puede aceptar: ${result.status}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo confirmar la compra.");
    } finally {
      setBusy(false);
    }
  }

  async function exitBuyerMode() {
    // The customer actor is intentionally left signed in; return without touching member auth.
    router.replace("/(tabs)");
  }

  return (
    <OperationList
      title="Comprar"
      subtitle="Catálogo AgeStyles. La sesión de cliente y el carrito se mantienen separados de tu tienda."
      loading={loading}
      error={error}
      onRefresh={() => void load(query)}
    >
      <Pressable style={styles.back} onPress={() => void exitBuyerMode()}>
        <View style={styles.backContent}>
          <Icon name="arrowLeft" size={18} color={theme.text} />
          <Text style={styles.backText}>Mi negocio</Text>
        </View>
      </Pressable>
      {!customer ? (
        <Section title="Sesión de cliente">
          <Text style={styles.hint}>
            El modo comprador usa una sesión independiente. Inicia sesión para cotizar y confirmar.
          </Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="Correo"
            placeholderTextColor={theme.placeholderText}
            style={styles.input}
          />
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            placeholderTextColor={theme.placeholderText}
            style={styles.input}
          />
          <Action
            title="Iniciar sesión como cliente"
            onPress={() => void signIn()}
            disabled={busy || !email || !password}
          />
        </Section>
      ) : (
        <View style={styles.session}>
          <Text style={styles.sessionText}>Cliente: {customer.email}</Text>
          <Pressable
            onPress={() => void signOut()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}
          >
            <Text style={styles.link}>{busy ? "Cerrando…" : "Salir"}</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.search}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void load(query)}
          placeholder="Buscar productos"
          placeholderTextColor={theme.placeholderText}
          style={styles.searchInput}
          returnKeyType="search"
        />
        <Pressable onPress={() => void load(query)}>
          <Text style={styles.link}>Buscar</Text>
        </Pressable>
      </View>
      <Section title="Productos y vendedores">
        {products.map((product) => (
          <View key={product.id} style={styles.product}>
            <Text style={styles.productTitle}>{product.title}</Text>
            {(offers[product.id] ?? []).map((offer) => (
              <View key={offer.id} style={styles.offer}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.seller}>{offer.seller.name}</Text>
                  <Text style={styles.price}>
                    {offer.price
                      ? money(offer.price.amount, offer.price.currency_code)
                      : "Consultar precio"}
                  </Text>
                </View>
                <Action
                  title="Añadir"
                  onPress={() => void addOffer(offer.id)}
                  disabled={busy || !cart}
                  compact
                />
              </View>
            ))}
          </View>
        ))}
        {!loading && products.length === 0 ? (
          <Text style={styles.hint}>No hay productos disponibles en esta región.</Text>
        ) : null}
      </Section>
      <Section title={`Carrito${cart?.items?.length ? ` · ${cart.items.length} artículos` : ""}`}>
        {(cart?.items ?? []).map((item) => (
          <View key={item.id} style={styles.cartItem}>
            <Text style={styles.productTitle}>{item.title}</Text>
            <Text style={styles.hint}>Cantidad {item.quantity}</Text>
          </View>
        ))}
        {!cart?.items?.length ? (
          <Text style={styles.hint}>
            Añade ofertas de diferentes vendedores para formar un carrito compartido.
          </Text>
        ) : (
          <Action
            title="Solicitar cotización"
            onPress={() => void requestQuote()}
            disabled={busy}
          />
        )}
        {quote ? (
          <View style={styles.quote}>
            <Text style={styles.productTitle}>Cotización · {quote.revision}</Text>
            <Text style={styles.hint}>
              {quote.seller_ids.length} vendedores · {money(quote.total, quote.currency_code)}
            </Text>
            <Action
              title="Confirmar compra"
              onPress={() => void acceptQuote()}
              disabled={busy || !quote.available}
            />
          </View>
        ) : null}
        {orders.length ? (
          <Text style={styles.success}>Compra creada: {orders.join(", ")}</Text>
        ) : null}
      </Section>
    </OperationList>
  );
}

function Action({
  title,
  onPress,
  disabled,
  compact,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, compact && styles.compact, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    back: { alignSelf: "flex-start", marginBottom: 8, paddingVertical: 8 },
    backContent: { flexDirection: "row", alignItems: "center", gap: 6 },
    backText: { color: theme.action, fontWeight: "600" },
    hint: { color: theme.muted, fontSize: 13, lineHeight: 19, padding: 14 },
    input: {
      marginHorizontal: 12,
      marginTop: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    action: {
      backgroundColor: theme.action,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 10,
      alignItems: "center",
      margin: 12,
    },
    compact: { margin: 0 },
    actionText: { color: theme.onAction, fontWeight: "600", fontSize: 13 },
    session: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
    },
    sessionText: { color: theme.text, fontSize: 13 },
    link: { color: theme.action, fontWeight: "600", padding: 8 },
    pressed: { opacity: 0.78 },
    disabled: { opacity: 0.45 },
    search: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingLeft: 12,
      marginTop: 17,
    },
    searchInput: { flex: 1, paddingVertical: 12, color: theme.text },
    product: {
      padding: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    productTitle: { color: theme.text, fontWeight: "600", fontSize: 15 },
    offer: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10 },
    seller: { color: theme.text, fontSize: 13 },
    price: { color: theme.muted, fontSize: 13, marginTop: 3 },
    cartItem: {
      padding: 14,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    quote: { marginTop: 12, paddingTop: 12, borderTopColor: theme.border, borderTopWidth: 1 },
    success: { color: theme.successText, padding: 14, fontWeight: "600" },
  });
