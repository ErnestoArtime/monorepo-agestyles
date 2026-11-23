// REVISIÓN PRECISA (2026-11-22, commit deb0e37 del monorepo):
// Este archivo es el sidebar REAL de Negocio. NO es Next.js ni Tailwind:
// es React Native + Expo Router + StyleSheet + tokens de
// @agestyles/design-tokens, con <Icon name="…"> de @agestyles/icons
// (lucide-react solo vive dentro de packages/icons, nunca se importa
// directo en una app) y SearchField de @agestyles/ui-native.
// Cambios del reel de Memorisely aplicados aquí, sin tocar el resto:
//  - colapsable 260 → 72 px, solo iconos, con accessibilityLabel;
//  - búsqueda arriba con SearchField, cableada: pasa el texto como
//    parámetro q a Productos (app/(tabs)/products.tsx lo lee con
//    useLocalSearchParams y filtra por título o SKU);
//  - badge rojo (theme.error + theme.onError) a la derecha de
//    Notificaciones, con el unreadCount real que ya existía;
//  - NO se añaden Ajustes ni Soporte: esas rutas no existen en el repo.
//  - NO se añade badge de Pedidos: no hay contador reutilizable
//    (openOrders es local del Resumen, con tope de 50).
// Móvil: este sidebar solo se monta en web ancha (app/_layout.tsx:
// isWideWeb y vendedor/admin); en móvil Negocio usa la tab bar.
import { NotificationBell, useOptionalNotifications } from "@agestyles/features-notifications";
import { Icon, type IconName } from "@agestyles/icons";
import { SearchField } from "@agestyles/ui-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandLockup } from "./brand-lockup";
import { useAdmin } from "../context/admin-context";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme, type BusinessTheme } from "../hooks/use-business-theme";
import { hasPermission } from "../lib/permissions";
import { memberDisplayName, memberRoleLabel } from "../lib/roles";

type Item = {
  label: string;
  icon: IconName;
  href: string;
  match: (path: string) => boolean;
  /** Solo si hay un contador real detrás. No inventes insignias. */
  badge?: number;
};

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
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  // Atajo web: Ctrl/Cmd+K o "/" enfoca la búsqueda, Esc la suelta.
  // (En React Native no hay ref de foco verificada en SearchField, por
  // eso el atajo solo limpia/enfoca cuando el campo lo permite; en web
  // el input nativo recibe el foco con el listener de abajo.)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Buscar en Negocio"]')?.focus();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Buscar en Negocio"]')?.focus();
      } else if (event.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSubmitSearch = () => {
    // La búsqueda pasa el texto por ruta: Productos lee q con
    // useLocalSearchParams y filtra por título o SKU.
    if (!query.trim()) return;
    router.push({ pathname: "/(tabs)/products", params: { q: query.trim() } } as Href);
  };

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
          label: "Información de la tienda",
          icon: "mapPin",
          href: "/store-info",
          match: (p) => p.startsWith("/store-info"),
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
          label: "Notificaciones",
          icon: "bell",
          href: "/notifications",
          match: (p) => p.startsWith("/notifications"),
          badge: unread,
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
        match: (p) => p.startsWith("/admin/tiendas") || p.startsWith("/admin/tienda-info"),
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
            title: both ? "Administración" : undefined,
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
    <View
      style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}
      role="navigation"
      accessibilityLabel="Menú de Negocio"
    >
      <View style={styles.top}>
        {collapsed ? null : <BrandLockup />}
        <Pressable
          onPress={() => setCollapsed((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Expandir menú" : "Colapsar menú"}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.collapseButton,
            hovered && { backgroundColor: theme.quietSurface },
          ]}
        >
          {/* No hay chevronLeft en @agestyles/icons: se usan arrowLeft/arrowRight. */}
          <Icon name={collapsed ? "arrowRight" : "arrowLeft"} size={18} color={theme.muted} />
        </Pressable>
        {collapsed ? null : <NotificationBell onPress={() => router.push("/notifications")} />}
      </View>
      {collapsed ? null : (
        <View style={styles.searchWrap}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar en Negocio"
            accessibilityLabel="Buscar en Negocio"
            returnKeyType="search"
            onSubmitEditing={onSubmitSearch}
          />
        </View>
      )}
      {seller && !collapsed ? (
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
              {section.title && !collapsed ? (
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
                      {group.title && !collapsed ? (
                        <Text style={styles.heading}>{group.title}</Text>
                      ) : null}
                      {group.items.map((item) => {
                        const active = item.match(pathname);
                        const badge = item.badge ?? 0;
                        return (
                          <Pressable
                            key={item.href}
                            onPress={() => router.push(item.href as Href)}
                            accessibilityRole="link"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={
                              collapsed
                                ? badge > 0
                                  ? `${item.label}, ${badge} sin leer`
                                  : item.label
                                : undefined
                            }
                            style={({ hovered }: { hovered?: boolean }) => [
                              styles.item,
                              collapsed && styles.itemCollapsed,
                              active && styles.itemActive,
                              hovered && !active && { backgroundColor: theme.quietSurface },
                            ]}
                          >
                            <View>
                              <Icon
                                name={item.icon}
                                size={18}
                                color={active ? theme.action : theme.muted}
                              />
                              {collapsed && badge > 0 ? <View style={styles.badgeDot} /> : null}
                            </View>
                            {collapsed ? null : (
                              <>
                                <Text
                                  style={[styles.itemText, active && styles.itemTextActive]}
                                  numberOfLines={1}
                                >
                                  {item.label}
                                </Text>
                                {badge > 0 ? (
                                  <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                      {badge > 99 ? "99+" : String(badge)}
                                    </Text>
                                  </View>
                                ) : null}
                              </>
                            )}
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
          style={[styles.account, collapsed && styles.accountCollapsed]}
          accessibilityLabel={`Sesión de ${accountName}, ${accountRole}`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{accountName.slice(0, 1).toUpperCase()}</Text>
          </View>
          {collapsed ? null : (
            <View style={styles.flex}>
              <Text style={styles.storeName} numberOfLines={1}>
                {accountName}
              </Text>
              <Text style={styles.muted} numberOfLines={1}>
                {accountRole}
                {accountEmail ? ` · ${accountEmail}` : ""}
              </Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={() => router.push("/tienda" as Href)}
          accessibilityRole="link"
          accessibilityLabel={collapsed ? "Comprar en AgeStyles" : undefined}
          style={[styles.item, collapsed && styles.itemCollapsed]}
        >
          <Icon name="shoppingBag" size={18} color={theme.muted} />
          {collapsed ? null : <Text style={styles.itemText}>Comprar en AgeStyles</Text>}
        </Pressable>
        <Pressable
          onPress={async () => {
            await logout();
            router.replace("/");
          }}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Cerrar sesión" : undefined}
          style={[styles.item, collapsed && styles.itemCollapsed]}
        >
          <Icon name="arrowLeft" size={18} color={theme.muted} />
          {collapsed ? null : <Text style={styles.itemText}>Cerrar sesión</Text>}
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
    sidebarCollapsed: { width: 72, paddingHorizontal: 8 },
    collapseButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    searchWrap: { marginTop: 12 },
    itemCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
    accountCollapsed: { justifyContent: "center", paddingHorizontal: 0 },
    badge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: theme.error,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: theme.onError, fontSize: 11, fontWeight: "700" },
    badgeDot: {
      position: "absolute",
      top: -2,
      right: -4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.error,
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
    itemText: { flex: 1, color: theme.text, fontSize: 14 },
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
