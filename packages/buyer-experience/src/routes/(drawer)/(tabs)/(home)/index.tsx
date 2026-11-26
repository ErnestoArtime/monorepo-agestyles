import { mediaVariant } from "@agestyles/api-client/media";
import { Loading } from "../../../../components/loading";
import { ProductCard } from "../../../../components/product-card";
import {
  activeFilterCount,
  EMPTY_FILTERS,
  FilterPanel,
  priceBounds,
  type CatalogFilters,
} from "../../../../components/filter-panel";
import { ProductDetail } from "../../../../components/product-detail";
import { FollowStoreButton, StoreAlertSwitch } from "../../../../components/follow-store-button";
import { StoreInfoPanel } from "../../../../components/store-info-panel";
import { useFollows } from "../../../../context/follows-context";
import { HomeCarousel, openBannerLink } from "../../../../components/home-carousel";
import { FeaturedRow } from "../../../../components/featured-row";
import { PillGroup, SearchField } from "@agestyles/ui-native";
import { AndroidAppLink } from "../../../../components/android-app-link";
import { WebFooter } from "../../../../components/web-footer";
import { CONTENT_MAX, useResponsive } from "../../../../hooks/use-responsive";
import { Colors } from "../../../../constants/theme";
import { useRegion } from "../../../../context/region-context";
import { useColorScheme } from "../../../../hooks/use-color-scheme";
import { Icon } from "@agestyles/icons";
import {
  cardAsProduct,
  fetchCatalog,
  fetchHome,
  type CatalogCard,
  type CatalogPage,
  type HomeBanner,
} from "../../../../lib/storefront";
import { sdk } from "../../../../config";
import type { HttpTypes } from "@medusajs/types";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/** Products per page asked to the server (AG-34): the first screen loads fast, the rest on scroll. */
const PAGE_SIZE = 24;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { selectedRegion, loading: regionLoading, error: regionError, reloadRegions } = useRegion();
  const router = useRouter();
  const { isWideWeb, columns } = useResponsive();
  const follows = useFollows();
  // Quick view: a bottom sheet on phones, a centred dialog in a wide browser; both link to the page.
  const openProduct = (product: HttpTypes.StoreProduct) => setSheetProductId(product.id);

  // Server-side catalog (AG-34): filtered, sorted and paged by the API, only what can be bought now.
  const [items, setItems] = useState<CatalogCard[]>([]);
  const [count, setCount] = useState(0);
  const [facets, setFacets] = useState<CatalogPage["facets"]>({
    categories: [],
    colors: [],
    max_price: 0,
  });
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Order, category, price and colour (the right-hand «Filtros» panel and the category pills).
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectedCategory = filters.category;
  const setSelectedCategory = (category: string | null) =>
    setFilters((current) => ({ ...current, category, color: null, size: null, brand: null }));
  // Product opened in the bottom sheet (reference POS behaviour).
  const [sheetProductId, setSheetProductId] = useState<string | null>(null);
  // Home banners and «Destacados», managed from Negocio's administration.
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [featured, setFeatured] = useState<CatalogCard[]>([]);
  // A store's own sections (its page only) and the one chosen.
  const [storeSections, setStoreSections] = useState<{ id: string; name: string }[]>([]);
  const [section, setSection] = useState<string | null>(null);
  // Filters opened from the side menu (categories with their subcategories, a store, novelties).
  const params = useLocalSearchParams<{
    filtro?: string;
    nombre?: string;
    ids?: string;
    tienda?: string;
    q?: string;
  }>();
  const menuFilter = useMemo(() => {
    if (params.filtro === "categoria" && params.ids) {
      return {
        kind: "categoria" as const,
        label: params.nombre ?? "Categoría",
        ids: params.ids.split(",").filter(Boolean),
      };
    }
    if (params.filtro === "tienda" && params.tienda) {
      return { kind: "tienda" as const, label: params.nombre ?? "Tienda", seller: params.tienda };
    }
    if (params.filtro === "novedades") return { kind: "novedades" as const, label: "Novedades" };
    return null;
  }, [params.filtro, params.ids, params.nombre, params.tienda]);

  useEffect(() => {
    // Opening a page from the menu starts from a clean list.
    // Excepto cuando llega una búsqueda (params.q): no borrarla, que
    // el efecto de q de abajo la aplica.
    setFilters(EMPTY_FILTERS);
    if (!params.q) {
      setSearchTerm("");
      setDebouncedSearch("");
    }
    setSection(null);
  }, [params.filtro, params.ids, params.tienda]);

  // Búsqueda que llega desde el sidebar o el drawer: ?q=texto.
  // Va después del efecto de limpieza para que q no se borre.
  useEffect(() => {
    setSearchTerm(params.q ?? "");
    setDebouncedSearch((params.q ?? "").trim());
  }, [params.q]);

  // A store's page shows its cover, logo and description above its products.
  const [storeProfile, setStoreProfile] = useState<{
    id: string;
    name: string;
    description?: string | null;
    logo?: string | null;
    banner?: string | null;
  } | null>(null);
  useEffect(() => {
    const sellerId = menuFilter?.kind === "tienda" ? menuFilter.seller : null;
    if (!sellerId) {
      setStoreProfile(null);
      return;
    }
    let active = true;
    sdk.client
      .fetch<{ seller: NonNullable<typeof storeProfile> }>(`/store/sellers/${sellerId}`, {
        query: { fields: "id,name,description,logo,banner" },
      })
      .then(({ seller }) => {
        if (active) setStoreProfile(seller);
      })
      .catch(() => {
        if (active) setStoreProfile(null);
      });
    return () => {
      active = false;
    };
  }, [menuFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const query = useMemo(() => {
    if (!selectedRegion) return null;
    const { min, max } = priceBounds(filters);
    return {
      regionId: selectedRegion.id,
      q: debouncedSearch || undefined,
      categoryIds: filters.category
        ? [filters.category]
        : menuFilter?.kind === "categoria"
          ? menuFilter.ids
          : undefined,
      sellerId: menuFilter?.kind === "tienda" ? menuFilter.seller : undefined,
      section: menuFilter?.kind === "tienda" && section ? section : undefined,
      minPrice: min ?? undefined,
      maxPrice: max ?? undefined,
      color: filters.color ?? undefined,
      size: filters.size ?? undefined,
      brand: filters.brand ?? undefined,
      sort:
        filters.sort === "featured" && menuFilter?.kind === "novedades" ? "newest" : filters.sort,
      limit: PAGE_SIZE,
    } as const;
  }, [debouncedSearch, filters, menuFilter, section, selectedRegion]);

  // Only the latest request may write the list (fast typing, quick filter changes).
  const requestId = useRef(0);
  const loadFirstPage = useCallback(async () => {
    if (!query) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchCatalog({ ...query, offset: 0 });
      if (id !== requestId.current) return;
      setItems(page.products);
      setCount(page.count);
      setFacets(page.facets);
      if (!query.categoryIds) setCategoryOptions(page.facets.categories);
      setLoadedOnce(true);
    } catch (err) {
      if (id !== requestId.current) return;
      console.error("Failed to fetch products:", err);
      setError("No se pudieron cargar los productos. Inténtalo de nuevo.");
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage, reloadKey]);

  const loadMore = async () => {
    if (!query || loading || loadingMore || items.length >= count) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchCatalog({ ...query, offset: items.length });
      if (id !== requestId.current) return;
      setItems((current) => {
        const seen = new Set(current.map((card) => card.id));
        return [...current, ...page.products.filter((card) => !seen.has(card.id))];
      });
      setCount(page.count);
    } catch (err) {
      console.error("Failed to fetch more products:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // The marketplace home, or the store's own banners and featured products on its page.
  const homeSellerId = menuFilter?.kind === "tienda" ? menuFilter.seller : null;
  useEffect(() => {
    if (!selectedRegion) return;
    let active = true;
    setBanners([]);
    setFeatured([]);
    setStoreSections([]);
    fetchHome(selectedRegion.id, homeSellerId)
      .then((home) => {
        if (!active) return;
        setBanners(home.banners);
        setFeatured(home.featured);
        setStoreSections(home.sections ?? []);
      })
      .catch(() => {
        // The home works without banners or featured products.
        if (active) {
          setBanners([]);
          setFeatured([]);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedRegion, reloadKey, homeSellerId]);

  const products = useMemo(
    () => items.map((card) => cardAsProduct(card, !homeSellerId)),
    [items, homeSellerId],
  );
  const directOffers = useMemo(
    () => new Map(items.map((card) => [card.id, card.direct_offer_id ?? undefined])),
    [items],
  );
  const categories = useMemo(
    () => categoryOptions.map((category) => ({ value: category.id, label: category.name })),
    [categoryOptions],
  );

  const onRefresh = () => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  };

  const openBanner = (banner: HomeBanner) =>
    openBannerLink(banner, {
      category: (id, name) => router.setParams({ filtro: "categoria", ids: id, nombre: name }),
      product: (id) => setSheetProductId(id),
      seller: (id, name) => router.setParams({ filtro: "tienda", tienda: id, nombre: name }),
    });

  if (regionLoading) {
    return <Loading message="Preparando el catálogo…" />;
  }

  if (!selectedRegion || regionError) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.statePanel,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
        >
          <Icon name="refresh" size={28} color={colors.tint} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            No pudimos preparar la tienda
          </Text>
          <Text style={[styles.errorText, { color: colors.icon }]}>
            {regionError ?? "No hay una región de compra disponible en este momento."}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Volver a cargar las regiones"
            onPress={() => void reloadRegions()}
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
          >
            <Text style={[styles.retryText, { color: colors.onTint }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!loadedOnce && (loading || !error)) {
    return <Loading message="Cargando productos..." />;
  }

  if (error && !loadedOnce) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.statePanel,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
        >
          <Icon name="refresh" size={28} color={colors.tint} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            El catálogo está tardando un poco más de lo habitual
          </Text>
          <Text style={[styles.errorText, { color: colors.icon }]}>{error}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void loadFirstPage()}
            style={[styles.retryButton, { backgroundColor: colors.tint }]}
          >
            <Text style={[styles.retryText, { color: colors.onTint }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // A category, a store, «Novedades» or «Todos los productos» open as their own page,
  // without the home hero.
  const isListing = Boolean(menuFilter) || params.filtro === "todos";
  const listingTitle = menuFilter?.label ?? "Todos los productos";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={products}
        key={`grid-${columns}`}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={[styles.row, isWideWeb && styles.wide]}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <View style={[styles.header, isWideWeb && [styles.wide, styles.wideHeader]]}>
            {isListing ? (
              <View style={styles.listingHeader}>
                <TouchableOpacity
                  accessibilityRole="link"
                  onPress={() =>
                    router.setParams({
                      filtro: undefined,
                      ids: undefined,
                      nombre: undefined,
                      tienda: undefined,
                    })
                  }
                  style={styles.listingBack}
                >
                  <Icon name="arrowLeft" size={16} color={colors.tint} />
                  <Text style={[styles.listingBackText, { color: colors.tint }]}>Inicio</Text>
                </TouchableOpacity>
                {storeProfile ? (
                  <>
                    <View
                      style={[
                        styles.storeHero,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                      ]}
                    >
                      <View
                        style={[
                          styles.storeCover,
                          isWideWeb && styles.storeCoverWide,
                          { backgroundColor: colors.surfaceMuted },
                        ]}
                      >
                        {storeProfile.banner ? (
                          <Image
                            source={{
                              uri: mediaVariant(storeProfile.banner, isWideWeb ? 1600 : 800),
                            }}
                            style={styles.fill}
                            contentFit="cover"
                            accessibilityIgnoresInvertColors
                          />
                        ) : null}
                      </View>
                      <View style={styles.storeIdentity}>
                        <View
                          style={[
                            styles.storeLogo,
                            {
                              backgroundColor: colors.surfaceMuted,
                              borderColor: colors.cardBackground,
                            },
                          ]}
                        >
                          {storeProfile.logo ? (
                            <Image
                              source={{ uri: mediaVariant(storeProfile.logo, 400) }}
                              style={styles.fill}
                              contentFit="cover"
                              accessibilityLabel={`Logo de ${storeProfile.name}`}
                            />
                          ) : (
                            <Icon name="store" size={30} color={colors.tint} />
                          )}
                        </View>
                        <View style={styles.storeText}>
                          <Text
                            accessibilityRole="header"
                            style={[styles.listingTitle, { color: colors.text }]}
                          >
                            {storeProfile.name}
                          </Text>
                          {storeProfile.description ? (
                            <Text style={[styles.storeDescription, { color: colors.icon }]}>
                              {storeProfile.description}
                            </Text>
                          ) : null}
                          <View style={styles.storeFollow}>
                            <FollowStoreButton
                              store={{
                                id: storeProfile.id,
                                name: storeProfile.name,
                                logo: storeProfile.logo,
                              }}
                            />
                          </View>
                        </View>
                      </View>
                      {follows.isFollowing(storeProfile.id) ? (
                        <View style={[styles.storeAlert, { borderColor: colors.border }]}>
                          <StoreAlertSwitch
                            store={{ id: storeProfile.id, name: storeProfile.name }}
                          />
                        </View>
                      ) : null}
                    </View>
                    <StoreInfoPanel sellerId={storeProfile.id} />
                  </>
                ) : (
                  <Text
                    accessibilityRole="header"
                    style={[styles.listingTitle, { color: colors.text }]}
                  >
                    {listingTitle}
                  </Text>
                )}
              </View>
            ) : null}
            {homeSellerId && banners.length ? (
              <View style={[styles.carousel, styles.storeCarousel]}>
                <HomeCarousel
                  banners={banners}
                  height={isWideWeb ? 320 : 200}
                  onOpen={openBanner}
                />
              </View>
            ) : null}
            {isWideWeb || isListing ? null : (
              <View style={[styles.betaNotice, { backgroundColor: colors.surfaceMuted }]}>
                <Icon name="help" size={16} color={colors.tint} />
                <Text style={[styles.betaCopy, { color: colors.text }]}>
                  AgeStyles está en fase piloto. Los pedidos son reales; si algo falla, avísanos.
                </Text>
              </View>
            )}
            {isListing ? null : banners.length ? (
              <>
                <View style={styles.carousel}>
                  <HomeCarousel
                    banners={banners}
                    height={isWideWeb ? 380 : 220}
                    onOpen={openBanner}
                  />
                </View>
                {isWideWeb ? null : <AndroidAppLink />}
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.hero,
                    isWideWeb && styles.heroWide,
                    { backgroundColor: colors.tint },
                  ]}
                >
                  <View style={styles.heroCopy}>
                    <Text
                      style={[
                        styles.heroTitle,
                        isWideWeb && styles.heroTitleWide,
                        { color: colors.onTint },
                      ]}
                    >
                      Lo que buscas.{"\n"}Más opciones.
                    </Text>
                    <Text
                      style={[
                        styles.heroDescription,
                        isWideWeb && styles.heroDescriptionWide,
                        { color: colors.onTint },
                      ]}
                    >
                      Descubre productos y compara ofertas de distintas tiendas.
                    </Text>
                    <Text style={[styles.heroLink, { color: colors.onTint }]}>
                      Explora el catálogo <Icon name="arrowRight" size={14} color={colors.onTint} />
                    </Text>
                  </View>
                  {products[0]?.thumbnail ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={"Ver " + products[0].title}
                      onPress={() => openProduct(products[0])}
                      style={[styles.heroImageFrame, isWideWeb && styles.heroImageFrameWide]}
                    >
                      <Image
                        source={{ uri: mediaVariant(products[0].thumbnail, 800) }}
                        style={[styles.heroImage, { backgroundColor: colors.imagePlaceholder }]}
                        contentFit="cover"
                        contentPosition="top"
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {isWideWeb ? null : <AndroidAppLink />}
              </>
            )}
            {(isListing && !homeSellerId) ||
            debouncedSearch ||
            activeFilterCount(filters) ? null : (
              <FeaturedRow
                cards={featured}
                tileWidth={isWideWeb ? 250 : 172}
                onOpen={openProduct}
              />
            )}
            <View style={[styles.searchArea, isWideWeb && styles.searchAreaWide]}>
              <View style={styles.searchRow}>
                <View style={styles.searchInput}>
                  <SearchField
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder="Buscar productos"
                  />
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    activeFilterCount(filters)
                      ? `Filtros, ${activeFilterCount(filters)} activos`
                      : "Filtros"
                  }
                  onPress={() => setFiltersOpen(true)}
                  style={[
                    styles.filterButton,
                    { borderColor: colors.border, backgroundColor: colors.cardBackground },
                  ]}
                >
                  <Icon name="sliders" size={18} color={colors.text} />
                  <Text style={[styles.filterText, { color: colors.text }]}>Filtros</Text>
                  {activeFilterCount(filters) ? (
                    <View style={[styles.filterBadge, { backgroundColor: colors.tint }]}>
                      <Text style={[styles.filterBadgeText, { color: colors.onTint }]}>
                        {activeFilterCount(filters)}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>
            </View>
            {homeSellerId && storeSections.length ? (
              // A store's page groups its products by its own sections.
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
              >
                <PillGroup
                  accessibilityLabel="Secciones de la tienda"
                  value={section ?? "__all__"}
                  onChange={(value) => setSection(value === "__all__" ? null : value)}
                  options={[
                    { value: "__all__", label: "Todos los productos" },
                    ...storeSections.map((entry) => ({ value: entry.id, label: entry.name })),
                  ]}
                />
              </ScrollView>
            ) : categories.length > 0 && menuFilter?.kind !== "categoria" ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryList}
              >
                <PillGroup
                  accessibilityLabel="Categorías"
                  value={selectedCategory ?? "__all__"}
                  onChange={(value) => setSelectedCategory(value === "__all__" ? null : value)}
                  options={[{ value: "__all__", label: "Todos los productos" }, ...categories]}
                />
              </ScrollView>
            ) : null}
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {isListing
                  ? "Productos"
                  : searchTerm || selectedCategory
                    ? "Resultados del catálogo"
                    : "Descubre algo especial"}
              </Text>
              <Text style={[styles.resultCount, { color: colors.icon }]}>
                {loading ? "Buscando…" : `${count} ${count === 1 ? "producto" : "productos"}`}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onOpen={openProduct}
            columns={columns}
            directOfferId={directOffers.get(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          <>
            {loadingMore ? (
              <View style={styles.moreLoading}>
                <ActivityIndicator color={colors.tint} />
                <Text style={[styles.resultCount, { color: colors.icon }]}>Cargando más…</Text>
              </View>
            ) : null}
            {isWideWeb ? <WebFooter /> : null}
          </>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search" size={24} color={colors.icon} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {isListing && !searchTerm && !activeFilterCount(filters)
                ? "Ahora mismo no hay productos disponibles aquí. Vuelve pronto."
                : !debouncedSearch && !activeFilterCount(filters)
                  ? "Aún no hay productos disponibles"
                  : "Ningún producto coincide con estos filtros"}
            </Text>
          </View>
        }
      />
      <FilterPanel
        visible={filtersOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
        colors={facets.colors}
        sizes={facets.sizes ?? []}
        brands={facets.brands ?? []}
        maxPriceHint={facets.max_price}
        resultCount={count}
      />
      <ProductDetail
        layout="sheet"
        productId={sheetProductId}
        onClose={() => setSheetProductId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    width: "100%",
    paddingBottom: 8,
  },
  searchArea: { marginHorizontal: 16, marginBottom: 12 },
  betaNotice: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  betaCopy: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  hero: {
    minHeight: 212,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
  },
  heroCopy: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    gap: 12,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
    fontWeight: "600",
  },
  heroDescription: {
    maxWidth: 230,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
  },
  heroLink: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
  },
  heroImageFrame: {
    width: "38%",
    margin: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  carousel: { marginHorizontal: 16 },
  storeCarousel: { marginBottom: 6 },
  fill: { width: "100%", height: "100%" },
  storeHero: {
    marginTop: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  storeCover: { aspectRatio: 16 / 6 },
  storeCoverWide: { aspectRatio: undefined, height: 280 },
  storeIdentity: { flexDirection: "row", alignItems: "flex-end", gap: 16, padding: 16 },
  storeLogo: {
    width: 96,
    height: 96,
    borderRadius: 22,
    borderWidth: 4,
    marginTop: -60,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  storeText: { flex: 1, gap: 4 },
  storeFollow: { marginTop: 6 },
  storeAlert: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  storeDescription: { fontSize: 14, lineHeight: 20 },
  moreLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  menuFilter: {
    alignSelf: "flex-start",
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 10,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sectionHeading: {
    paddingHorizontal: 16,
    marginTop: 27,
    marginBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 21,
    letterSpacing: -0.35,
    fontWeight: "600",
    flexShrink: 1,
  },
  resultCount: {
    fontSize: 12,
    flexShrink: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  wide: { width: "100%", maxWidth: CONTENT_MAX, alignSelf: "center" },
  wideHeader: { paddingTop: 20 },
  searchAreaWide: { marginTop: 20 },
  listingHeader: { marginHorizontal: 16, marginTop: 18, marginBottom: 14, gap: 6 },
  listingBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    minHeight: 32,
  },
  listingBackText: { fontSize: 14, fontWeight: "600" },
  listingTitle: { fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1 },
  filterButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterText: { fontSize: 15, fontWeight: "600" },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { fontSize: 12, fontWeight: "700" },
  heroWide: { minHeight: 340, borderRadius: 20 },
  heroTitleWide: { fontSize: 46, lineHeight: 52, letterSpacing: -1.2 },
  heroDescriptionWide: { maxWidth: 440, fontSize: 17, lineHeight: 26 },
  heroImageFrameWide: { width: "46%", margin: 12, borderRadius: 16 },
  row: {
    justifyContent: "flex-start",
    paddingHorizontal: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  statePanel: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: "center",
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
