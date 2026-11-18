import { NotificationBell, useOptionalNotifications } from "@agestyles/features-notifications";
import { Icon, type IconName } from "@agestyles/icons";
import { usePathname, useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandLockup } from "./brand-lockup";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme, type BusinessTheme } from "../hooks/use-business-theme";
import { hasPermission } from "../lib/permissions";
import { memberDisplayName, memberRoleLabel } from "../lib/roles";

type Item = { label: string; icon: IconName; href: string; match: (path: string) => boolean };

/**
 * Side menu of Negocio in a wide browser, like any web back office: every section is one
 * click away instead of behind the tab bar and «Más». Permissions decide what is listed;
 * the server still enforces them.
 */
export function WebSidebar() {
  const theme = useBusinessTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const pathname = usePathname();
  const { seller, sellers, member, logout } = useBusiness();
  const unread = useOptionalNotifications()?.unreadCount ?? 0;

  const groups: { title?: string; items: Item[] }[] = [
    {
      items: [
        { label: "Resumen", icon: "home", href: "/(tabs)", match: (p) => p === "/" || p === "" },
        ...(hasPermission(member, "products")
          ? [
              {
                label: "Productos",
                icon: "package" as IconName,
                href: "/(tabs)/products",
                match: (p: string) => p.startsWith("/products") || p.startsWith("/product-new"),
              },
            ]
          : []),
        {
          label: "Inventario",
          icon: "warehouse",
          href: "/(tabs)/inventory",
          match: (p) => p.startsWith("/inventory"),
        },
        {
          label: "Movimientos",
          icon: "refresh",
          href: "/movements",
          match: (p) => p.startsWith("/movements"),
        },
        ...(hasPermission(member, "orders")
          ? [
              {
                label: "Pedidos",
                icon: "list" as IconName,
                href: "/(tabs)/orders",
                match: (p: string) => p.startsWith("/orders"),
              },
            ]
          : []),
        {
          label: "Comisiones",
          icon: "creditCard",
          href: "/commissions",
          match: (p) => p.startsWith("/commissions") || p.startsWith("/agent-sale"),
        },
      ],
    },
    {
      title: "Tienda",
      items: [
        ...(hasPermission(member, "products", "edit")
          ? [
              {
                label: "Importar catálogo",
                icon: "boxes" as IconName,
                href: "/catalog-import",
                match: (p: string) => p.startsWith("/catalog-import"),
              },
            ]
          : []),
        ...(member?.is_owner || member?.permissions?.members === "manage"
          ? [
              {
                label: "Equipo y permisos",
                icon: "shieldCheck" as IconName,
                href: "/(tabs)/team",
                match: (p: string) => p.startsWith("/team"),
              },
            ]
          : []),
        {
          label: unread ? `Notificaciones (${unread})` : "Notificaciones",
          icon: "bell",
          href: "/notifications",
          match: (p) => p.startsWith("/notifications"),
        },
        {
          label: "Avisos",
          icon: "settings",
          href: "/notification-preferences",
          match: (p) => p.startsWith("/notification-preferences"),
        },
        {
          label: "Más opciones",
          icon: "more",
          href: "/(tabs)/more",
          match: (p) => p.startsWith("/more"),
        },
      ],
    },
  ];

  return (
    <View style={styles.sidebar} role="navigation" accessibilityLabel="Menú de Negocio">
      <View style={styles.top}>
        <BrandLockup />
        <NotificationBell onPress={() => router.push("/notifications")} />
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/more" as Href)}
        accessibilityRole="button"
        accessibilityLabel={
          sellers.length > 1 ? `Tienda ${seller?.name ?? ""}, cambiar de tienda` : "Tu tienda"
        }
        style={({ hovered }: { hovered?: boolean }) => [
          styles.store,
          hovered && { backgroundColor: theme.selectedSurface },
        ]}
      >
        <View style={styles.flex}>
          <Text style={styles.storeName} numberOfLines={1}>
            {seller?.name ?? "Tienda"}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {seller?.handle ? `@${seller.handle}` : "AgeStyles"}
            {sellers.length > 1 ? " · cambiar" : ""}
          </Text>
        </View>
        {sellers.length > 1 ? <Icon name="chevronDown" size={16} color={theme.muted} /> : null}
      </Pressable>
      <ScrollView style={styles.flex} contentContainerStyle={styles.groups}>
        {groups.map((group, index) => (
          <View key={group.title ?? index} style={styles.group}>
            {group.title ? <Text style={styles.heading}>{group.title}</Text> : null}
            {group.items.map((item) => {
              const active = item.match(pathname);
              return (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href as Href)}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  style={({ hovered }: { hovered?: boolean }) => [
                    styles.item,
                    active && styles.itemActive,
                    hovered && !active && { backgroundColor: theme.quietSurface },
                  ]}
                >
                  <Icon name={item.icon} size={18} color={active ? theme.action : theme.muted} />
                  <Text style={[styles.itemText, active && styles.itemTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <View style={styles.bottom}>
        <View
          style={styles.account}
          accessibilityLabel={`Sesión de ${memberDisplayName(member)}, ${memberRoleLabel(member)}`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {memberDisplayName(member).slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.storeName} numberOfLines={1}>
              {memberDisplayName(member)}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {memberRoleLabel(member)}
              {member?.member?.email ? ` · ${member.member.email}` : ""}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/tienda" as Href)}
          accessibilityRole="link"
          style={styles.item}
        >
          <Icon name="shoppingBag" size={18} color={theme.muted} />
          <Text style={styles.itemText}>Comprar en AgeStyles</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
          accessibilityRole="button"
          style={styles.item}
        >
          <Icon name="arrowLeft" size={18} color={theme.muted} />
          <Text style={styles.itemText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: BusinessTheme) =>
  StyleSheet.create({
    sidebar: {
      width: 260,
      backgroundColor: theme.surface,
      borderRightColor: theme.border,
      borderRightWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12,
      paddingTop: 16,
      paddingBottom: 12,
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      minHeight: 44,
    },
    store: {
      marginTop: 14,
      marginBottom: 8,
      padding: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    storeName: { color: theme.text, fontSize: 15, fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 12, marginTop: 2 },
    flex: { flex: 1 },
    groups: { gap: 14, paddingVertical: 6 },
    group: { gap: 2 },
    heading: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    item: {
      minHeight: 40,
      borderRadius: 8,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    itemActive: { backgroundColor: theme.selectedSurface },
    itemText: { color: theme.text, fontSize: 14 },
    itemTextActive: { color: theme.action, fontWeight: "600" },
    account: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.selectedSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: theme.action, fontSize: 15, fontWeight: "700" },
    bottom: {
      borderTopColor: theme.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: 8,
      gap: 2,
    },
  });
