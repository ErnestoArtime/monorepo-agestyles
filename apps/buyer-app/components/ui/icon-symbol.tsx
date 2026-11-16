import { Icon, type IconName } from "@agestyles/icons"
import { View, type StyleProp, type ViewStyle } from "react-native"

const iconAliases: Record<string, IconName> = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevronRight",
  "chevron.down": "chevronDown",
  "line.3.horizontal": "menu",
  "cart.fill": "shoppingCart",
  "creditcard": "creditCard",
  "phone-portrait-outline": "phone",
  "arrow-down-outline": "arrowDown",
  "trash": "trash",
}

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string
  size?: number
  color: string | number
  style?: StyleProp<ViewStyle>
  weight?: string
}) {
  return <View style={style}><Icon name={iconAliases[name] || "help"} size={size} color={typeof color === "string" ? color : "#171717"} /></View>
}
