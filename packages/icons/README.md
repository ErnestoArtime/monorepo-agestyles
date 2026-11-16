# @agestyles/icons

AgeStyles uses this package as the single icon source for the buyer app, business app, storefront, and web dashboards. Its semantic names and Lucide stroke style stay consistent across web, Android, and iOS; platform resolution selects inline SVG on web and React Native SVG on mobile, so tab and button icons do not depend on asynchronously loaded icon fonts.

    import { Icon } from "@agestyles/icons"

    <Icon name="shoppingCart" size={22} color={active ? "#182231" : "#777777"} />

Use a semantic name, a consistent 1.8 stroke width, and the active/inactive color from the containing control. Buttons and icon-only controls must provide their accessible label on the interactive parent. Add new glyphs to both platform entry points together.
