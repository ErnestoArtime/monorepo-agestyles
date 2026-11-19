import { Children, useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";

/**
 * Cards in as many columns as fit (one on phones, two or three in a wide browser), with the
 * same gap as the single-column list. The width is measured, so it also works in tablets.
 */
export function CardGrid({
  children,
  minColumnWidth = 340,
  gap = 12,
  maxColumns = 3,
}: {
  children: ReactNode;
  minColumnWidth?: number;
  gap?: number;
  /** Indicator rows can use four; record lists stay at three. */
  maxColumns?: number;
}) {
  const [width, setWidth] = useState(0);
  const columns = Math.max(
    1,
    Math.min(maxColumns, Math.floor((width + gap) / (minColumnWidth + gap))),
  );
  const itemWidth = width ? (width - gap * (columns - 1)) / columns : undefined;
  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap }}
    >
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={{ width: columns === 1 || !itemWidth ? "100%" : itemWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
}
