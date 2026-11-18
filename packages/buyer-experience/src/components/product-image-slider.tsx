import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { Image } from "expo-image";
import React, { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";

interface ProductImageSliderProps {
  images: string[];
  /** Square slides as wide as the gallery (product page in a wide browser). */
  square?: boolean;
  /** Clickable thumbnails under the main image instead of dots. */
  thumbnails?: boolean;
}

/** Swipeable gallery sized to its container, so it works in sheets, phones and wide pages. */
export function ProductImageSlider({ images, square, thumbnails }: ProductImageSliderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const imageListRef = useRef<FlatList<string>>(null);
  const height = square ? width : 400;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems.length > 0) setCurrentImageIndex(viewableItems[0].index || 0);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  if (images.length === 0) return null;

  const show = (index: number) => {
    setCurrentImageIndex(index);
    imageListRef.current?.scrollToIndex({ index, animated: true });
  };

  return (
    <View
      style={styles.container}
      onLayout={(event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width))}
    >
      {width > 0 ? (
        <FlatList
          ref={imageListRef}
          data={images}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item }}
              style={{ width, height, backgroundColor: colors.imagePlaceholder }}
              contentFit={square ? "contain" : "cover"}
            />
          )}
          keyExtractor={(_, index) => `image-${index}`}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      ) : (
        <View style={{ height: square ? 0 : height }} />
      )}
      {images.length > 1 && thumbnails ? (
        <View style={styles.thumbnails}>
          {images.map((uri, index) => (
            <Pressable
              key={`thumb-${index}`}
              onPress={() => show(index)}
              accessibilityRole="button"
              accessibilityLabel={`Ver foto ${index + 1} de ${images.length}`}
              accessibilityState={{ selected: currentImageIndex === index }}
              style={[
                styles.thumbnail,
                { borderColor: currentImageIndex === index ? colors.tint : colors.border },
              ]}
            >
              <Image
                source={{ uri }}
                style={[styles.thumbnailImage, { backgroundColor: colors.imagePlaceholder }]}
                contentFit="cover"
              />
            </Pressable>
          ))}
        </View>
      ) : images.length > 1 ? (
        <View style={styles.pagination}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                {
                  backgroundColor: currentImageIndex === index ? colors.tint : colors.icon + "40",
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", width: "100%" },
  pagination: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  paginationDot: { width: 8, height: 8, borderRadius: 4 },
  thumbnails: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 12 },
  thumbnail: { width: 72, height: 72, borderRadius: 10, borderWidth: 2, overflow: "hidden" },
  thumbnailImage: { width: "100%", height: "100%" },
});
