import { ProductImageSlider } from "@/components/product-image-slider";
import { ProductSkeleton } from "@/components/product-skeleton";
import { Toast } from "@/components/ui/toast";
import { WebFooter } from "@/components/web-footer";
import { CONTENT_MAX, useResponsive } from "@/hooks/use-responsive";
import { useCart } from "@/context/cart-context";
import { useRegion } from "@/context/region-context";
import { useCupRate } from "@/hooks/use-cup-rate";
import { formatPrice } from "@/lib/format-price";
import { sdk } from "@/lib/sdk";
import { formatCupEquivalent } from "@agestyles/api-client/exchange-rate";
import { listProductOffers } from "@agestyles/api-client/offers";
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
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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

  const [product, setProduct] = useState<HttpTypes.StoreProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!productId || !selectedRegion) return;
    try {
      setLoading(true);
      setError(null);
      setQuantity(1);
      const { product: fetched } = await sdk.store.product.retrieve(productId, {
        fields: "*variants.calculated_price,+variants.inventory_quantity",
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
    if (!variantId || !regionId) return;
    let active = true;
    listProductOffers(sdk.client, { variantId, regionId })
      .then(({ offers: list }) => {
        if (active)
          setOffers(list.filter((offer) => offer.available_quantity !== 0 && offer.price));
      })
      .catch(() => {
        if (active)
          setToast({ message: "No se pudieron cargar las ofertas de las tiendas", type: "error" });
      });
    return () => {
      active = false;
    };
  }, [regionId, variantId]);

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
  const inStock = !!selectedOffer;

  async function add() {
    if (!selectedOffer) {
      setToast({
        message: showOptions ? "Selecciona todas las opciones" : "Variante no disponible",
        type: "error",
      });
      return;
    }
    try {
      setAdding(true);
      await addToCart(selectedOffer.id, quantity);
      setToast({ message: "Producto añadido al carrito", type: "success" });
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
          <Text style={[styles.price, { color: color.text }]}>
            {price === undefined ? "—" : formatPrice(price, currency)}
          </Text>
          {cup ? <Text style={[styles.cup, { color: color.muted }]}>{cup}</Text> : null}
        </View>
      </View>
      {!inStock ? <StatusBadge label="Agotado" tone="error" icon="alert" /> : null}
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
        </View>
      ) : selectedOffer ? (
        <Text style={[styles.soldBy, { color: color.muted }]}>
          Vendido por {selectedOffer.seller.name}
        </Text>
      ) : null}
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(drawer)/(tabs)/compare",
            params: { productId: product.id },
          } as unknown as Href)
        }
        accessibilityRole="button"
        style={styles.compare}
      >
        <Icon name="sliders" size={18} color={color.action} />
        <Text style={[styles.compareText, { color: color.action }]}>Comparar producto</Text>
      </Pressable>
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
          title={inStock ? "Añadir al carrito" : "Agotado"}
          onPress={() => void add()}
          loading={adding}
          disabled={!inStock}
          style={styles.addButton}
        />
      </>
    ) : null;

  const toastView = (
    <Toast
      message={toast?.message ?? ""}
      visible={!!toast}
      onHide={() => setToast(null)}
      type={toast?.type ?? "success"}
    />
  );

  if (props.layout === "sheet") {
    const onClose = props.onClose;
    // Quick view → full product page with the description, features and every store.
    const fullPage = product ? (
      <Pressable
        onPress={() => {
          onClose();
          router.push({
            pathname: `/(home)/product/${product.id}`,
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
                {body ?? (
                  <View style={styles.wideColumns}>
                    <View style={styles.dialogGallery}>{gallery}</View>
                    <View style={[styles.wideInfo, styles.dialogInfo]}>
                      {info}
                      {purchaseBar ? <View style={styles.wideBuy}>{purchaseBar}</View> : null}
                      {fullPage}
                    </View>
                  </View>
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
                router.canGoBack() ? router.back() : router.push("/(drawer)/(tabs)/(home)" as Href)
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
          </View>
          <WebFooter />
        </ScrollView>
        {toastView}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: color.background }]}>
      <ScrollView contentContainerStyle={styles.screenContent}>{content}</ScrollView>
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
  dialogGallery: { flex: 10, maxWidth: 460 },
  dialogInfo: { paddingRight: 44 },
  wideBuy: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
});
