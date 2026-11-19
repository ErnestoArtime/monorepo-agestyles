import { mediaVariant } from "@agestyles/api-client/media";
import { Icon } from "@agestyles/icons";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import type { HomeBanner } from "../lib/storefront";

/**
 * Home banners (AG-34), managed in Negocio's administration: one slide at a time, swipe or
 * arrows, auto-advance every 6 s (paused while the person interacts), dots to jump.
 */
export function HomeCarousel({
  banners,
  height,
  onOpen,
}: {
  banners: HomeBanner[];
  height: number;
  onOpen: (banner: HomeBanner) => void;
}) {
  const colors = Colors[useColorScheme() ?? "light"];
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const go = (next: number) => {
    const target = (next + banners.length) % banners.length;
    setIndex(target);
    scroller.current?.scrollTo({ x: target * width, animated: true });
  };

  useEffect(() => {
    if (paused || banners.length < 2 || !width) return;
    const timer = setInterval(() => go(index + 1), 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banners.length, index, paused, width]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="none"
      accessibilityLabel="Destacamos"
    >
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScrollBeginDrag={() => setPaused(true)}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner.id}
            onPress={() => onOpen(banner)}
            onHoverIn={() => setPaused(true)}
            onHoverOut={() => setPaused(false)}
            accessibilityRole={banner.link.kind === "none" ? "image" : "link"}
            accessibilityLabel={banner.title}
            style={{ width, height }}
          >
            <Image
              source={{ uri: mediaVariant(banner.image_url, width <= 520 ? 800 : 1600) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <View style={styles.shade} />
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={2}>
                {banner.title}
              </Text>
              {banner.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {banner.subtitle}
                </Text>
              ) : null}
              {banner.link.kind !== "none" ? (
                <View style={[styles.cta, { backgroundColor: colors.background }]}>
                  <Text style={[styles.ctaText, { color: colors.text }]}>
                    {banner.cta ?? "Ver más"}
                  </Text>
                  <Icon name="arrowRight" size={14} color={colors.text} />
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {banners.length > 1 ? (
        <>
          <Pressable
            onPress={() => go(index - 1)}
            accessibilityRole="button"
            accessibilityLabel="Banner anterior"
            style={[styles.arrow, styles.left]}
          >
            <Icon name="arrowLeft" size={18} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => go(index + 1)}
            accessibilityRole="button"
            accessibilityLabel="Banner siguiente"
            style={[styles.arrow, styles.right]}
          >
            <Icon name="arrowRight" size={18} color="#fff" />
          </Pressable>
          <View style={styles.dots}>
            {banners.map((banner, dot) => (
              <Pressable
                key={banner.id}
                onPress={() => go(dot)}
                accessibilityRole="button"
                accessibilityLabel={`Ir al banner ${dot + 1}`}
                style={[styles.dot, dot === index && styles.dotActive]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Where a banner leads (category, product, store or an external page). */
export function openBannerLink(
  banner: HomeBanner,
  handlers: {
    category: (id: string, name: string) => void;
    product: (id: string) => void;
    seller: (id: string, name: string) => void;
  },
) {
  const { kind, value, label } = banner.link;
  if (!value) return;
  if (kind === "category") handlers.category(value, label ?? banner.title);
  else if (kind === "product") handlers.product(value);
  else if (kind === "seller") handlers.seller(value, label ?? banner.title);
  else if (kind === "url") void Linking.openURL(value);
}

const styles = StyleSheet.create({
  frame: { borderRadius: 18, overflow: "hidden", backgroundColor: "#222" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  copy: { position: "absolute", left: 24, right: 24, bottom: 34, gap: 8, maxWidth: 560 },
  title: { color: "#fff", fontSize: 30, lineHeight: 34, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: "#fff", fontSize: 15, lineHeight: 21, opacity: 0.95 },
  cta: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaText: { fontSize: 14, fontWeight: "700" },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  left: { left: 12 },
  right: { right: 12 },
  dots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { width: 22, backgroundColor: "#fff" },
});
