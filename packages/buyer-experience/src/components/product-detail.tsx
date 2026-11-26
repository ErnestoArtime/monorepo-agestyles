import { ProductImageSlider } from "./product-image-slider";
import { ProductSkeleton } from "./product-skeleton";
import { ShareButton } from "./share-button";
import { useToast } from "@agestyles/ui-native";
import { WebFooter } from "./web-footer";
import { ProductExtras, StoreLink } from "./product-extras";
import { CONTENT_MAX, useResponsive } from "../hooks/use-responsive";
import { useCart } from "../context/cart-context";
import { useRegion } from "../context/region-context";
import { useCupRate } from "../hooks/use-cup-rate";
import { formatPrice } from "../lib/format-price";
import { sdk } from "../config";
import { formatCupEquivalent, rateSourceLine } from "@agestyles/api-client/exchange-rate";
import { listProductOffers } from "@agestyles/api-client/offers";
import { gaEvent } from "../lib/google-analytics";
import { trackProductEvent } from "../lib/product-events";
import { Icon } from "@agestyles/icons";
import {
  BottomSheet,
  Button,
  PillGroup,
  StatusBadge,
  Stepper,
  useUiTheme,
} from "@agestyles/ui-native";
import type { HttpTypes } from "@medusajs/types";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buyerHref, buyerPath } from "../config";

type Offer = Awaited<ReturnType<typeof listProductOffers>>["offers"][number];

/**
 * Product detail shared by the catalog's bottom sheet and the product route
 * (shared links). Layout follows the reference POS: gallery, name and price on
 * one line, options as pills, sellers, then quantity and «Añadir al carrito».
 */
export function ProductDetail(
  props:
    | { productId: string; layout: "screen"; onTitle?: (title: string) => void }
    | { productId: string | null; layout: "sheet"; onClose: () => void },
) {
  const { color } = useUiTheme();
  const router = useRouter();
  const { addToCart } = useCart();
  const { selectedRegion } = useRegion();
  const cupRate = useCupRate();
  const productId = props.productId;
  const { isWideWeb } = useResponsive();
  // A wide browser shows the product page in two columns, like a web shop, and the
  // catalog's quick view as a centred dialog instead of the phone's bottom sheet.
  const wide = props.layout === "screen" && isWideWeb;
  const dialog = props.layout === "sheet" && isWideWeb;
  // The quick view closes before opening a store's page.
  const closeSheet = props.layout === "sheet" ? props.onClose : undefined;

  const [product, setProduct] = useState<HttpTypes.StoreProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [offers, setOffers] = useState<Offer[]>([]);
  // Until the stores' offers arrive the availability is unknown, not «Agotado».
  const [offersLoading, setOffersLoading] = useState(true);
  const [offerId, setOfferId] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The shared toast (bottom of the screen, above the tab bar), like every other action.
  const globalToast = useToast();
  const setToast = (next: { message: string; type: "success" | "error" } | null) => {
    if (next) globalToast.show(next.message, next.type);
  };
  /** (product, seller) pairs already reported as views in this mount. */
  const viewedSellers = useRef(new Set<string>());

  const fetchProduct = useCallback(async () => {
    if (!productId || !selectedRegion) return;
    try {
      setLoading(true);
      setError(null);
      setQuantity(1);
      const { product: fetched } = await sdk.store.product.retrieve(productId, {
        fields: "*variants.calculated_price,+variants.inventory_quantity,*categories",
        region_id: selectedRegion.id,
      });
      setProduct(fetched);
      const initial: Record<string, string> = {};
      fetched.variants?.[0]?.options?.forEach((optionValue) => {
        if (optionValue.option_id && optionValue.value) {
          initial[optionValue.option_id] = optionValue.value;
        }
      });
      setSelectedOptions(initial);
    } catch {
      setError("No se pudo cargar el producto. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [productId, selectedRegion]);

  useEffect(() => {
    void fetchProduct();
  }, [fetchProduct]);

  const onTitle = props.layout === "screen" ? props.onTitle : undefined;
  useEffect(() => {
    if (product?.title) onTitle?.(product.title);
  }, [onTitle, product?.title]);

  const selectedVariant = useMemo(() => {
    if (
      !product?.variants ||
      !product.options ||
      Object.keys(selectedOptions).length !== product.options.length
    ) {
      return undefined;
    }
    return product.variants.find((variant) =>
      variant.options?.every((value) => value.value === selectedOptions[value.option_id!]),
    );
  }, [product, selectedOptions]);

  const variantId = selectedVariant?.id;
  const regionId = selectedRegion?.id;
  useEffect(() => {
    setOffers([]);
    setOfferId(undefined);
    setOffersLoading(true);
    if (!variantId || !regionId) {
      // No complete variant chosen yet: nothing to look up.
      if (product) setOffersLoading(false);
      return;
    }
    let active = true;
    listProductOffers(sdk.client, { variantId, regionId })
      .then(({ offers: list }) => {
        if (active)
          setOffers(list.filter((offer) => offer.available_quantity !== 0 && offer.price));
      })
      .catch(() => {
        if (active)
          setToast({ message: "No se pudieron cargar las ofertas de las tiendas", type: "error" });
      })
      .finally(() => {
        if (active) setOffersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [product, regionId, variantId]);

  // Anonymous view, once per seller that offers this product (AG-59): each
  // store's traffic is its own. Fires when the offers arrive, not on every
  // variant change — the ref keeps a pair from being reported twice.
  useEffect(() => {
    if (!product || !offers.length) return;
    for (const offer of offers) {
      const key = `${product.id}:${offer.seller.id}`;
      if (viewedSellers.current.has(key)) continue;
      viewedSellers.current.add(key);
      void trackProductEvent({
        product_id: product.id,
        seller_id: offer.seller.id,
        type: "product_view",
      });
    }
    // Google Analytics gets the same view once, only when it is loaded.
    gaEvent("view_item", {
      currency: offers[0]?.price?.currency_code,
      value: offers[0]?.price?.amount,
      items: [{ item_id: product.id, item_name: product.title }],
    });
  }, [product, offers]);

  const selectedOffer =
    offers.find((offer) => offer.id === offerId && offer.variant?.id === variantId) ??
    offers.find((offer) => offer.variant?.id === variantId);
  const showOptions = !!product?.options?.some((option) => (option.values?.length ?? 0) > 1);
  const images = useMemo(() => {
    const list = product?.images?.map((image) => image.url).filter(Boolean) ?? [];
    return list.length ? list : product?.thumbnail ? [product.thumbnail] : [];
  }, [product]);
  const price = selectedOffer?.price?.amount;
  const currency = selectedOffer?.price?.currency_code ?? selectedRegion?.currency_code;
  const cup = formatCupEquivalent(price, currency, cupRate);
  const cupSource = cup ? rateSourceLine(cupRate) : null;
  const inStock = !!selectedOffer;

  async function add() {
    if (!selectedOffer) {
      setToast({
        message: showOptions ? "Selecciona todas las opciones" : "Variante no disponible",
        type: "error",
      });
      return;
    }
    // The click itself is the event (AG-59), whether or not the cart accepts it.
    void trackProductEvent({
      product_id: product?.id ?? productId,
      seller_id: selectedOffer.seller.id,
      type: "add_to_cart_click",
    });
    gaEvent("add_to_cart", {
      currency: selectedOffer.price?.currency_code ?? currency,
      value: (selectedOffer.price?.amount ?? 0) * quantity,
      items: [
        {
          item_id: product?.id ?? productId,
          item_name: product?.title,
          price: selectedOffer.price?.amount,
          quantity,
        },
      ],
    });
    try {
      setAdding(true);
      await addToCart(selectedOffer.id, quantity);
    } catch {
      setToast({ message: "No se pudo añadir el producto al carrito", type: "error" });
    } finally {
      setAdding(false);
    }
  }

  const body = loading ? (
    <ProductSkeleton />
  ) : error || !product ? (
    <View style={styles.center}>
      <Text style={[styles.error, { color: color.text }]}>{error ?? "Producto no encontrado"}</Text>
      <Button title="Reintentar" variant="secondary" onPress={() => void fetchProduct()} />
    </View>
  ) : null;

  const gallery = (
    <View style={[styles.gallery, { backgroundColor: color.placeholder }]}>
      <ProductImageSlider images={images} square={wide || dialog} thumbnails={wide || dialog} />
    </View>
  );

  const info = product ? (
    <>
      <View style={styles.titleRow}>
        <Text style={[styles.title, (wide || dialog) && styles.titleWide, { color: color.text }]}>
          {product.title}
        </Text>
        <View style={styles.priceBlock}>
          {offersLoading ? (
            <View style={[styles.priceSkeleton, { backgroundColor: color.placeholder }]} />
          ) : (
            <Text style={[styles.price, { color: color.text }]}>
              {price === undefined ? "—" : formatPrice(price, currency)}
            </Text>
          )}
          {cup ? <Text style={[styles.cup, { color: color.muted }]}>{cup}</Text> : null}
          {cupSource ? (
            <Text style={[styles.cupSource, { color: color.muted }]}>{cupSource}</Text>
          ) : null}
        </View>
      </View>
      {offersLoading ? (
        <View style={[styles.badgeSkeleton, { backgroundColor: color.placeholder }]} />
      ) : !inStock ? (
        <StatusBadge label="Agotado" tone="error" icon="alert" />
      ) : null}
      {product.description ? (
        <Text style={[styles.description, { color: color.muted }]}>{product.description}</Text>
      ) : null}
      {showOptions
        ? product.options?.map((option) => (
            <View key={option.id} style={styles.group}>
              <Text style={[styles.groupTitle, { color: color.text }]}>{option.title}</Text>
              <PillGroup
                accessibilityLabel={option.title ?? "Opción"}
                value={selectedOptions[option.id!]}
                onChange={(value) =>
                  setSelectedOptions((current) => ({ ...current, [option.id!]: value }))
                }
                options={(option.values ?? []).map((value) => ({
                  value: value.value!,
                  label: value.value!,
                }))}
              />
            </View>
          ))
        : null}
      {offers.length > 1 ? (
        <View style={styles.group}>
          {/* Each store in the list, and below it a link to the chosen one's page. */}
          <Text style={[styles.groupTitle, { color: color.text }]}>Tienda</Text>
          {offers.map((offer) => {
            const selected = selectedOffer?.id === offer.id;
            return (
              <Pressable
                key={offer.id}
                onPress={() => setOfferId(offer.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.seller,
                  {
                    borderColor: selected ? color.action : color.border,
                    backgroundColor: selected ? color.selectedSurface : color.surface,
                  },
                ]}
              >
                <Text style={[styles.sellerName, { color: color.text }]}>{offer.seller.name}</Text>
                <Text style={[styles.sellerPrice, { color: color.text }]}>
                  {formatPrice(offer.price?.amount, offer.price?.currency_code ?? currency)}
                </Text>
              </Pressable>
            );
          })}
          {selectedOffer ? (
            <StoreLink
              seller={selectedOffer.seller}
              label={`Ver la tienda ${selectedOffer.seller.name}`}
              onBeforeOpen={closeSheet}
            />
          ) : null}
        </View>
      ) : selectedOffer ? (
        <View style={styles.soldByRow}>
          <Text style={[styles.soldBy, { color: color.muted }]}>Vendido por</Text>
          <StoreLink seller={selectedOffer.seller} onBeforeOpen={closeSheet} />
        </View>
      ) : null}
      {/* Comparing is hidden while the catalog has few products with technical features. */}
      <ShareButton
        product={product}
        price={price === undefined ? undefined : formatPrice(price, currency)}
        variant="label"
      />
    </>
  ) : null;

  const content = body ?? (
    <View style={styles.body}>
      {gallery}
      {info}
    </View>
  );

  const purchaseBar =
    product && !loading && !error ? (
      <>
        <Stepper value={quantity} onChange={setQuantity} min={1} />
        <Button
          title={offersLoading ? "Comprobando…" : inStock ? "Añadir al carrito" : "Agotado"}
          onPress={() => void add()}
          loading={adding}
          disabled={offersLoading || !inStock}
          style={styles.addButton}
        />
      </>
    ) : null;

  const storeSeller = selectedOffer?.seller ?? offers[0]?.seller ?? null;
  const extras =
    props.layout === "screen" && product && !loading && !error ? (
      <ProductExtras
        productId={product.id}
        categoryIds={(product.categories ?? []).map((category) => category.id)}
        seller={storeSeller ? { id: storeSeller.id, name: storeSeller.name } : null}
      />
    ) : null;

  const toastView = null;

  if (props.layout === "sheet") {
    const onClose = props.onClose;
    // Quick view → full product page with the description, features and every store.
    const fullPage = product ? (
      <Pressable
        onPress={() => {
          onClose();
          router.push({
            pathname: buyerPath(`/(drawer)/(tabs)/(home)/product/${product.id}`),
            params: { title: product.title },
          } as unknown as Href);
        }}
        accessibilityRole="link"
        style={styles.compare}
      >
        <Text style={[styles.compareText, { color: color.action }]}>Ver ficha completa</Text>
        <Icon name="arrowRight" size={16} color={color.action} />
      </Pressable>
    ) : null;

    if (dialog) {
      return (
        <Modal
          visible={!!props.productId}
          transparent
          animationType="fade"
          onRequestClose={onClose}
        >
          <View style={styles.dialogHost}>
            <Pressable
              style={[StyleSheet.absoluteFill, styles.dialogBackdrop]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar vista rápida"
            />
            <View
              accessibilityViewIsModal
              accessibilityLabel={
                product?.title ? `Vista rápida: ${product.title}` : "Vista rápida"
              }
              style={[styles.dialog, { backgroundColor: color.surface }]}
            >
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                hitSlop={10}
                style={[styles.dialogClose, { backgroundColor: color.background }]}
              >
                <Icon name="close" size={20} color={color.text} />
              </Pressable>
              <ScrollView contentContainerStyle={styles.dialogContent}>
                {loading ? (
                  // Same footprint as the loaded dialog, so it does not resize when the data arrives.
                  <View style={styles.dialogLoading}>
                    <ActivityIndicator color={color.action} />
                  </View>
                ) : (
                  (body ?? (
                    <View style={styles.wideColumns}>
                      <View style={styles.dialogGallery}>{gallery}</View>
                      <View style={[styles.wideInfo, styles.dialogInfo]}>
                        {info}
                        {purchaseBar ? <View style={styles.wideBuy}>{purchaseBar}</View> : null}
                        {fullPage}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
              {toastView}
            </View>
          </View>
        </Modal>
      );
    }

    return (
      <BottomSheet visible={!!props.productId} onClose={onClose} footer={purchaseBar}>
        {content}
        {fullPage}
        {toastView}
      </BottomSheet>
    );
  }
  if (wide) {
    return (
      <View style={[styles.screen, { backgroundColor: color.background }]}>
        <ScrollView>
          <View style={styles.widePage}>
            <Pressable
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.push(buyerHref("/(drawer)/(tabs)/(home)") as Href)
              }
              accessibilityRole="link"
              style={styles.back}
            >
              <Icon name="arrowLeft" size={18} color={color.action} />
              <Text style={[styles.compareText, { color: color.action }]}>Volver al catálogo</Text>
            </Pressable>
            {body ?? (
              <View style={styles.wideColumns}>
                <View style={styles.wideGallery}>{gallery}</View>
                <View style={styles.wideInfo}>
                  {info}
                  {purchaseBar ? <View style={styles.wideBuy}>{purchaseBar}</View> : null}
                </View>
              </View>
            )}
            {extras}
          </View>
          <WebFooter />
        </ScrollView>
        {toastView}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: color.background }]}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        {content}
        <View style={styles.phoneExtras}>{extras}</View>
      </ScrollView>
      {purchaseBar ? (
        <View
          style={[
            styles.screenBar,
            { borderTopColor: color.border, backgroundColor: color.surface },
          ]}
        >
          {purchaseBar}
        </View>
      ) : null}
      {toastView}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenContent: { padding: 16, paddingBottom: 32 },
  // The sections below bring their own 16 px margins.
  phoneExtras: { marginHorizontal: -16 },
  soldByRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  screenBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  center: { alignItems: "center", gap: 12, paddingVertical: 32 },
  error: { fontSize: 16, textAlign: "center" },
  body: { gap: 16 },
  gallery: { borderRadius: 14, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: "600" },
  priceBlock: { alignItems: "flex-end" },
  price: { fontSize: 20, fontWeight: "700" },
  cup: { fontSize: 13, marginTop: 2 },
  cupSource: { fontSize: 11, marginTop: 1 },
  description: { fontSize: 14, lineHeight: 21 },
  group: { gap: 10 },
  groupTitle: { fontSize: 15, fontWeight: "600" },
  seller: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sellerName: { fontSize: 14, fontWeight: "600" },
  sellerPrice: { fontSize: 15, fontWeight: "600" },
  soldBy: { fontSize: 13 },
  compare: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  compareText: { fontSize: 14, fontWeight: "600" },
  addButton: { flex: 1 },
  priceSkeleton: { width: 72, height: 22, borderRadius: 6 },
  badgeSkeleton: { width: 96, height: 24, borderRadius: 12 },
  widePage: {
    width: "100%",
    maxWidth: CONTENT_MAX,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  back: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8 },
  wideColumns: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
  wideGallery: { flex: 11, maxWidth: 640 },
  wideInfo: { flex: 9, gap: 16, paddingTop: 4 },
  titleWide: { fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
  dialogHost: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  dialogBackdrop: { backgroundColor: "rgba(0,0,0,0.55)" },
  dialog: {
    width: "100%",
    maxWidth: 980,
    minHeight: 516,
    maxHeight: "90%",
    borderRadius: 18,
    overflow: "hidden",
  },
  dialogClose: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogContent: { padding: 28 },
  dialogLoading: { height: 460, alignItems: "center", justifyContent: "center" },
  dialogGallery: { flex: 10, maxWidth: 460 },
  dialogInfo: { paddingRight: 44 },
  wideBuy: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
});
