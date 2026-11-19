import { NotificationBell, useOptionalNotifications } from "@agestyles/features-notifications";
import { Icon, type IconName } from "@agestyles/icons";
import { usePathname, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandLockup } from "./brand-lockup";
import { useAdmin } from "../context/admin-context";
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
  const { admin } = useAdmin();

  const storeGroups: { title?: string; items: Item[] }[] = [
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
        ...(member?.is_owner || hasPermission(member, "orders")
          ? [
              {
                label: "Análisis",
                icon: "chart" as IconName,
                href: "/analytics",
                match: (p: string) => p.startsWith("/analytics"),
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
        {
          label: "Perfil de la tienda",
          icon: "store",
          href: "/store-profile",
          match: (p) => p.startsWith("/store-profile"),
        },
        {
          label: "Portada de mi tienda",
          icon: "home",
          href: "/store-home",
          match: (p) => p.startsWith("/store-home"),
        },
        {
          label: "Secciones de mi tienda",
          icon: "list",
          href: "/store-sections",
          match: (p) => p.startsWith("/store-sections"),
        },
        {
          label: "Solicitar categoría",
          icon: "plus",
          href: "/category-requests",
          match: (p) => p.startsWith("/category-requests"),
        },
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
  const adminGroup: { title?: string; items: Item[] } = {
    title: "Administración",
    items: [
      {
        label: "Avisos",
        icon: "bell",
        href: "/admin/avisos",
        match: (p) => p.startsWith("/admin/avisos"),
      },
      {
        label: "Usuarios",
        icon: "userCircle",
        href: "/admin/usuarios",
        match: (p) => p.startsWith("/admin/usuarios"),
      },
      {
        label: "Tiendas",
        icon: "store",
        href: "/admin/tiendas",
        match: (p) => p.startsWith("/admin/tiendas"),
      },
      {
        label: "Pedidos del marketplace",
        icon: "list",
        href: "/admin/pedidos",
        match: (p) => p.startsWith("/admin/pedidos"),
      },
      {
        label: "Productos en revisión",
        icon: "shieldCheck",
        href: "/admin/revision",
        match: (p) => p.startsWith("/admin/revision"),
      },
      {
        label: "Portada de la Tienda",
        icon: "home",
        href: "/admin/portada",
        match: (p) => p.startsWith("/admin/portada"),
      },
      {
        label: "Codificadores",
        icon: "tag",
        href: "/admin/codificadores",
        match: (p) => p.startsWith("/admin/codificadores"),
      },
      {
        label: "Solicitudes de categoría",
        icon: "boxes",
        href: "/admin/categorias",
        match: (p) => p.startsWith("/admin/categorias"),
      },
      {
        label: "Mantenimiento",
        icon: "settings",
        href: "/admin/mantenimiento",
        match: (p) => p.startsWith("/admin/mantenimiento"),
      },
    ],
  };
  // The store sections need a selected store; the administration needs an administrator.
  // With both, each is a collapsible block: the store's options or the whole marketplace.
  const both = Boolean(seller && admin);
  const sections: {
    key: "store" | "admin";
    title?: string;
    groups: { title?: string; items: Item[] }[];
  }[] = [
    ...(seller
      ? [{ key: "store" as const, title: both ? seller.name : undefined, groups: storeGroups }]
      : []),
    ...(admin
      ? [
          {
            key: "admin" as const,
            title: both ? "Administración del marketplace" : undefined,
            groups: both ? [{ items: adminGroup.items }] : [adminGroup],
          },
        ]
      : []),
  ];
  const inAdmin = pathname.startsWith("/admin");
  const [open, setOpen] = useState({ store: !inAdmin, admin: inAdmin });
  // Opening a page shows its block.
  useEffect(() => {
    setOpen({ store: !inAdmin, admin: inAdmin });
  }, [inAdmin]);
  const accountName =
    memberDisplayName(member) === "Tu cuenta" && admin
      ? [admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.email
      : memberDisplayName(member);
  const accountRole = [admin ? "Superadministrador" : null, seller ? memberRoleLabel(member) : null]
    .filter(Boolean)
    .join(" · ");
  const accountEmail = member?.member?.email ?? admin?.email ?? "";

  return (
    <View style={styles.sidebar} role="navigation" accessibilityLabel="Menú de Negocio">
      <View style={styles.top}>
        <BrandLockup />
        <NotificationBell onPress={() => router.push("/notifications")} />
      </View>
      {seller ? (
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
      ) : null}
      <ScrollView style={styles.flex} contentContainerStyle={styles.groups}>
        {sections.map((section) => {
          const expanded = !section.title || open[section.key];
          return (
            <View key={section.key} style={styles.section}>
              {section.title ? (
                <Pressable
                  onPress={() =>
                    // Accordion: opening one block folds the other, so its options are in view.
                    setOpen(
                      open[section.key]
                        ? { ...open, [section.key]: false }
                        : { store: section.key === "store", admin: section.key === "admin" },
                    )
                  }
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${section.title}: ${expanded ? "plegar" : "desplegar"}`}
                  style={({ hovered }: { hovered?: boolean }) => [
                    styles.sectionHeader,
                    hovered && { backgroundColor: theme.quietSurface },
                  ]}
                >
                  <Icon
                    name={section.key === "admin" ? "shieldCheck" : "store"}
                    size={16}
                    color={theme.action}
                  />
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    {section.title}
                  </Text>
                  <Icon
                    name={expanded ? "chevronDown" : "chevronRight"}
                    size={16}
                    color={theme.muted}
                  />
                </Pressable>
              ) : null}
              {expanded
                ? section.groups.map((group, index) => (
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
                            <Icon
                              name={item.icon}
                              size={18}
                              color={active ? theme.action : theme.muted}
                            />
                            <Text style={[styles.itemText, active && styles.itemTextActive]}>
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))
                : null}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.bottom}>
        <View
          style={styles.account}
          accessibilityLabel={`Sesión de ${accountName}, ${accountRole}`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{accountName.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.storeName} numberOfLines={1}>
              {accountName}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {accountRole}
              {accountEmail ? ` · ${accountEmail}` : ""}
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
    section: { gap: 4 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 40,
      paddingHorizontal: 10,
      borderRadius: 10,
      marginTop: 4,
    },
    sectionTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
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
