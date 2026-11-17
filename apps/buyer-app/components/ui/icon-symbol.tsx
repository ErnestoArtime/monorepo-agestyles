import { Icon, type IconName } from "@agestyles/icons";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { View, type StyleProp, type ViewStyle } from "react-native";

const iconAliases = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevronRight",
  "chevron.down": "chevronDown",
  "line.3.horizontal": "menu",
  "cart.fill": "shoppingCart",
  creditcard: "creditCard",
  "phone-portrait-outline": "phone",
  "arrow-down-outline": "arrowDown",
  trash: "trash",
} as const satisfies Record<string, IconName>;

export type IconSymbolName = keyof typeof iconAliases;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | number;
  style?: StyleProp<ViewStyle>;
}) {
  const colorScheme = useColorScheme();
  const fallbackColor = Colors[colorScheme ?? "light"].text;

  return (
    <View style={style}>
      <Icon
        name={iconAliases[name]}
        size={size}
        color={typeof color === "string" ? color : fallbackColor}
      />
    </View>
  );
}
