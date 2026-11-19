import { Icon, type IconName } from "@agestyles/icons";
import { listBuyerOrderGroups, type BuyerOrderGroup } from "@agestyles/api-client/buyer-orders";
import { unreadLabel } from "@agestyles/api-client/notifications";
import { useOptionalNotifications } from "@agestyles/features-notifications";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { FormField } from "../../../../components/account/form-field";
import { OrderGroupRow } from "../../../../components/account/order-group-row";
import { AddressForm } from "../../../../components/checkout/address-form";
import { Button } from "../../../../components/ui/button";
import { buyerHref, buyerPath, sdk } from "../../../../config";
import { Colors } from "../../../../constants/theme";
import { useCustomer } from "../../../../context/customer-context";
import { useRegion } from "../../../../context/region-context";
import { useColorScheme } from "../../../../hooks/use-color-scheme";
import { useResponsive } from "../../../../hooks/use-responsive";
import {
  addressSummary,
  EMPTY_ADDRESS,
  fieldsFromSaved,
  missingAddressField,
  useSavedAddresses,
  type AddressFields,
  type SavedAddress,
} from "../../../../lib/addresses";

type Section = "resumen" | "datos" | "direcciones";
type Palette = (typeof Colors)[keyof typeof Colors];

const SECTIONS: { value: Section; label: string; icon: IconName }[] = [
  { value: "resumen", label: "Resumen", icon: "home" },
  { value: "datos", label: "Datos personales", icon: "user" },
  { value: "direcciones", label: "Direcciones de entrega", icon: "mapPin" },
];

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length ? parts.slice(0, 2).map((p) => p[0]) : [email[0] ?? "?"];
  return letters.join("").toUpperCase();
}

function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
  } else Alert.alert(title, message);
}

function confirmDelete(message: string): Promise<boolean> {
  if (Platform.OS === "web")
    return Promise.resolve(typeof window === "undefined" || window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert("Eliminar dirección", message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Eliminar", style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

/**
 * «Mi cuenta»: in a wide browser a website account area (side menu and content), on
 * phones the same sections one under another. Profile, delivery addresses and recent orders.
 */
export default function AccountScreen() {
  const { customer, loading, logout } = useCustomer();
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isWideWeb } = useResponsive();
  const params = useLocalSearchParams<{ seccion?: string }>();
  const section: Section = SECTIONS.some((s) => s.value === params.seccion)
    ? (params.seccion as Section)
    : "resumen";
  const [signingOut, setSigningOut] = useState(false);
  const unread = useOptionalNotifications()?.unreadCount ?? 0;
  const addressBook = useSavedAddresses();

  const go = (next: Section) =>
    router.setParams({ seccion: next === "resumen" ? undefined : next } as never);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      notify("No se pudo cerrar sesión", "Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
        <Text style={styles.muted}>Verificando tu cuenta…</Text>
      </View>
    );
  }

  if (!customer) {
    return (
      <ScrollView contentContainerStyle={[styles.page, styles.signedOutPage]}>
        <View style={[styles.card, styles.signedOut]}>
          <View style={styles.avatarLarge}>
            <Icon name="user" size={28} color={colors.tint} />
          </View>
          <Text style={styles.h1}>Tu cuenta de AgeStyles</Text>
          <Text style={styles.body}>
            Inicia sesión para ver tus compras, guardar tus direcciones de entrega y pagar más
            rápido.
          </Text>
          <Button
            title="Iniciar sesión"
            onPress={() => router.push(buyerHref("/(drawer)/(tabs)/account/login"))}
          />
          <Button
            title="Crear una cuenta"
            variant="secondary"
            onPress={() => router.push(buyerHref("/(drawer)/(tabs)/account/register"))}
          />
        </View>
      </ScrollView>
    );
  }

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ");

  const nav = (
    <View style={[styles.card, isWideWeb ? styles.aside : null]}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(name, customer.email)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.identityName} numberOfLines={1}>
            {name || "Tu cuenta"}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {customer.email}
          </Text>
        </View>
      </View>
      <View style={styles.navList} role="navigation" accessibilityLabel="Secciones de tu cuenta">
        {SECTIONS.map((item) => (
          <NavItem
            key={item.value}
            styles={styles}
            colors={colors}
            icon={item.icon}
            label={item.label}
            active={isWideWeb && section === item.value}
            onPress={() => go(item.value)}
          />
        ))}
        <NavItem
          styles={styles}
          colors={colors}
          icon="package"
          label="Mis compras"
          onPress={() => router.push(buyerHref("/(drawer)/(tabs)/account/orders"))}
        />
        <NavItem
          styles={styles}
          colors={colors}
          icon="bell"
          label="Notificaciones"
          badge={unread}
          accessibilityLabel={unreadLabel(unread)}
          onPress={() => router.push(buyerHref("/notifications"))}
        />
        <NavItem
          styles={styles}
          colors={colors}
          icon="settings"
          label="Preferencias de avisos"
          onPress={() => router.push(buyerHref("/notification-preferences"))}
        />
      </View>
      <View style={styles.separator} />
      <Button
        title="Cerrar sesión"
        variant="secondary"
        loading={signingOut}
        onPress={() => void handleSignOut()}
      />
    </View>
  );

  const content =
    section === "datos" ? (
      <ProfileSection styles={styles} />
    ) : section === "direcciones" ? (
      <AddressesSection styles={styles} colors={colors} book={addressBook} />
    ) : (
      <SummarySection
        styles={styles}
        colors={colors}
        firstName={customer.first_name ?? ""}
        addresses={addressBook.addresses}
        onOpen={go}
      />
    );

  const back =
    !isWideWeb && section !== "resumen" ? (
      <Pressable accessibilityRole="link" onPress={() => go("resumen")} style={styles.backLink}>
        <Icon name="arrowLeft" size={16} color={colors.tint} />
        <Text style={styles.link}>Mi cuenta</Text>
      </Pressable>
    ) : null;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
    >
      {isWideWeb ? (
        <View style={styles.columns}>
          {nav}
          <View style={styles.main}>{content}</View>
        </View>
      ) : (
        <View style={styles.stack}>
          {section === "resumen" ? nav : back}
          {content}
        </View>
      )}
    </ScrollView>
  );
}

function NavItem({
  styles,
  colors,
  icon,
  label,
  active,
  badge,
  accessibilityLabel,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Palette;
  icon: IconName;
  label: string;
  active?: boolean;
  badge?: number;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.navItem,
        (hovered || pressed) && { backgroundColor: colors.surfaceMuted },
        active && styles.navItemActive,
      ]}
    >
      <Icon name={icon} size={18} color={active ? colors.tint : colors.icon} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : (
        <Icon name="chevronRight" size={16} color={colors.icon} />
      )}
    </Pressable>
  );
}

function SummarySection({
  styles,
  colors,
  firstName,
  addresses,
  onOpen,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Palette;
  firstName: string;
  addresses: SavedAddress[];
  onOpen: (section: Section) => void;
}) {
  const [orders, setOrders] = useState<BuyerOrderGroup[] | null>(null);
  useEffect(() => {
    let active = true;
    listBuyerOrderGroups(sdk.client, { limit: 3 })
      .then((result) => active && setOrders(result.order_groups ?? []))
      .catch(() => active && setOrders([]));
    return () => {
      active = false;
    };
  }, []);
  const main = addresses[0];

  return (
    <View style={styles.stack}>
      <View style={styles.heading}>
        <Text style={styles.h1}>{firstName ? `Hola, ${firstName}` : "Hola"}</Text>
        <Text style={styles.body}>Aquí tienes tus compras, tus datos y tus direcciones.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.h2}>Compras recientes</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push(buyerHref("/(drawer)/(tabs)/account/orders"))}
          >
            <Text style={styles.link}>Ver todas</Text>
          </Pressable>
        </View>
        {orders === null ? (
          <ActivityIndicator color={colors.tint} />
        ) : orders.length ? (
          <View style={styles.stackSmall}>
            {orders.map((group) => (
              <OrderGroupRow key={group.id} group={group} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyRow}>
            <Text style={styles.muted}>Todavía no has hecho ninguna compra.</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                router.navigate({
                  pathname: buyerPath("/(drawer)/(tabs)/(home)"),
                  params: { filtro: "todos" },
                } as never)
              }
            >
              <Text style={styles.link}>Ver productos</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.grid}>
        <View style={[styles.card, styles.gridItem]}>
          <View style={styles.cardHeader}>
            <Text style={styles.h2}>Dirección de entrega</Text>
            <Pressable accessibilityRole="link" onPress={() => onOpen("direcciones")}>
              <Text style={styles.link}>{addresses.length ? "Gestionar" : "Añadir"}</Text>
            </Pressable>
          </View>
          {main ? (
            <>
              <Text style={styles.strong}>{main.address_name || "Principal"}</Text>
              <Text style={styles.muted}>{addressSummary(main)}</Text>
              {addresses.length > 1 ? (
                <Text style={styles.muted}>
                  y {addresses.length - 1} {addresses.length === 2 ? "dirección más" : "más"}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.muted}>
              Guarda dónde quieres recibir tus pedidos y elígela al pagar.
            </Text>
          )}
        </View>
        <View style={[styles.card, styles.gridItem]}>
          <View style={styles.cardHeader}>
            <Text style={styles.h2}>Datos personales</Text>
            <Pressable accessibilityRole="link" onPress={() => onOpen("datos")}>
              <Text style={styles.link}>Editar</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>Tu nombre y teléfono de contacto para las entregas.</Text>
        </View>
      </View>
    </View>
  );
}

function ProfileSection({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const { customer, updateProfile } = useCustomer();
  const [firstName, setFirstName] = useState(customer?.first_name ?? "");
  const [lastName, setLastName] = useState(customer?.last_name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    if (!firstName.trim()) {
      setError("Escribe tu nombre.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateProfile({ firstName, lastName, phone });
      setMessage("Datos guardados.");
    } catch {
      setError("No se pudieron guardar tus datos. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.heading}>
        <Text style={styles.h1}>Datos personales</Text>
        <Text style={styles.body}>Los usamos para tus pedidos y para contactarte.</Text>
      </View>
      <View style={[styles.card, styles.form]}>
        <View style={styles.formRow}>
          <View style={styles.formCell}>
            <FormField
              label="Nombre"
              value={firstName}
              onChangeText={setFirstName}
              autoComplete="given-name"
            />
          </View>
          <View style={styles.formCell}>
            <FormField
              label="Apellidos"
              value={lastName}
              onChangeText={setLastName}
              autoComplete="family-name"
            />
          </View>
        </View>
        <FormField
          label="Teléfono"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <FormField
          label="Correo electrónico"
          value={customer?.email ?? ""}
          editable={false}
          accessibilityHint="El correo con el que entras no se puede cambiar aquí"
        />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <View style={styles.actionsRow}>
          <Button title="Guardar cambios" loading={saving} onPress={() => void save()} />
        </View>
      </View>
    </View>
  );
}

function AddressesSection({
  styles,
  colors,
  book,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: Palette;
  book: ReturnType<typeof useSavedAddresses>;
}) {
  const { customer } = useCustomer();
  const { selectedRegion } = useRegion();
  const countries = selectedRegion?.countries ?? [];
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [fields, setFields] = useState<AddressFields>(EMPTY_ADDRESS);
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const open = (target: SavedAddress | "new") => {
    setEditing(target);
    setError("");
    if (target === "new") {
      setFields({
        ...EMPTY_ADDRESS,
        firstName: customer?.first_name ?? "",
        lastName: customer?.last_name ?? "",
        phone: customer?.phone ?? "",
        countryCode: countries.length === 1 ? (countries[0].iso_2 ?? "") : "",
      });
      setLabel("");
      setIsDefault(book.addresses.length === 0);
    } else {
      setFields(fieldsFromSaved(target));
      setLabel(target.address_name ?? "");
      setIsDefault(Boolean(target.is_default_shipping));
    }
  };
  const set = (field: keyof AddressFields) => (value: string) =>
    setFields((current) => ({ ...current, [field]: value }));

  const save = async () => {
    const missing = missingAddressField(fields);
    if (missing) {
      setError(missing);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await book.save(fields, {
        id: editing && editing !== "new" ? editing.id : undefined,
        name: label,
        isDefault,
      });
      setEditing(null);
    } catch {
      setError("No se pudo guardar la dirección. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: SavedAddress) => {
    if (!(await confirmDelete(`¿Eliminar la dirección «${item.address_name || item.address_1}»?`)))
      return;
    try {
      await book.remove(item.id);
    } catch {
      notify("No se pudo eliminar", "Inténtalo de nuevo en unos segundos.");
    }
  };

  return (
    <View style={styles.stack}>
      <View style={[styles.heading, styles.headingRow]}>
        <View style={styles.flex}>
          <Text style={styles.h1}>Direcciones de entrega</Text>
          <Text style={styles.body}>Elige una de ellas al pagar y no tendrás que escribirla.</Text>
        </View>
        {editing === null ? <Button title="Añadir dirección" onPress={() => open("new")} /> : null}
      </View>

      {editing !== null ? (
        <View style={[styles.card, styles.form]}>
          <Text style={styles.h2}>
            {editing === "new" ? "Nueva dirección" : "Editar dirección"}
          </Text>
          <FormField
            label="Nombre de la dirección (opcional)"
            placeholder="Casa, trabajo, casa de mamá…"
            value={label}
            onChangeText={setLabel}
          />
          <AddressForm
            firstName={fields.firstName}
            lastName={fields.lastName}
            address={fields.address}
            city={fields.city}
            postalCode={fields.postalCode}
            countryCode={fields.countryCode}
            phone={fields.phone}
            countries={countries}
            onFirstNameChange={set("firstName")}
            onLastNameChange={set("lastName")}
            onAddressChange={set("address")}
            onCityChange={set("city")}
            onPostalCodeChange={set("postalCode")}
            onCountryCodeChange={set("countryCode")}
            onPhoneChange={set("phone")}
          />
          <View style={styles.switchRow}>
            <Text style={[styles.body, styles.flex]}>Usar como dirección principal</Text>
            <Switch value={isDefault} onValueChange={setIsDefault} />
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View style={styles.actionsRow}>
            <Button title="Cancelar" variant="secondary" onPress={() => setEditing(null)} />
            <Button title="Guardar dirección" loading={saving} onPress={() => void save()} />
          </View>
        </View>
      ) : null}

      {book.loading && !book.addresses.length ? (
        <ActivityIndicator color={colors.tint} />
      ) : book.addresses.length ? (
        <View style={styles.grid}>
          {book.addresses.map((item) => (
            <View key={item.id} style={[styles.card, styles.gridItem]}>
              <View style={styles.cardHeader}>
                <View style={styles.addressTitle}>
                  <Icon name="mapPin" size={18} color={colors.tint} />
                  <Text style={styles.strong} numberOfLines={1}>
                    {item.address_name || item.address_1 || "Dirección"}
                  </Text>
                </View>
                {item.is_default_shipping ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Principal</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.body}>
                {[item.first_name, item.last_name].filter(Boolean).join(" ")}
              </Text>
              <Text style={styles.muted}>
                {[item.address_1, [item.postal_code, item.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
              {item.phone ? <Text style={styles.muted}>Tel. {item.phone}</Text> : null}
              <View style={styles.linkRow}>
                <Pressable accessibilityRole="button" onPress={() => open(item)}>
                  <Text style={styles.link}>Editar</Text>
                </Pressable>
                {!item.is_default_shipping ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      void book
                        .makeDefault(item.id)
                        .catch(() => notify("No se pudo cambiar", "Inténtalo de nuevo."))
                    }
                  >
                    <Text style={styles.link}>Hacer principal</Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" onPress={() => void remove(item)}>
                  <Text style={styles.danger}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : editing === null ? (
        <View style={[styles.card, styles.emptyCard]}>
          <Icon name="mapPin" size={28} color={colors.icon} />
          <Text style={styles.body}>Aún no has guardado ninguna dirección.</Text>
          <Text style={styles.muted}>También puedes guardarla al hacer tu próxima compra.</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    page: { flexGrow: 1, padding: 20, paddingBottom: 40 },
    signedOutPage: { justifyContent: "center", alignItems: "center" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
    columns: { flexDirection: "row", alignItems: "flex-start", gap: 28 },
    aside: { width: 300, flexShrink: 0 },
    main: { flex: 1, minWidth: 0 },
    stack: { gap: 18 },
    stackSmall: { gap: 10 },
    flex: { flex: 1, minWidth: 0 },
    card: {
      backgroundColor: colors.cardBackground,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 14,
      padding: 18,
      gap: 10,
    },
    signedOut: { width: "100%", maxWidth: 440, alignItems: "stretch", gap: 14, padding: 28 },
    avatarLarge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    identity: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 6 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.tint,
    },
    avatarText: { color: colors.onTint, fontSize: 16, fontWeight: "700" },
    identityName: { color: colors.text, fontSize: 16, fontWeight: "700" },
    navList: { gap: 2 },
    navItem: {
      minHeight: 44,
      paddingHorizontal: 10,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    navItemActive: { backgroundColor: colors.surfaceMuted },
    navText: { flex: 1, color: colors.text, fontSize: 15 },
    navTextActive: { fontWeight: "700" },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.error,
    },
    badgeText: { color: colors.onError, fontSize: 12, fontWeight: "700" },
    heading: { gap: 6 },
    headingRow: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: 12 },
    h1: { color: colors.text, fontSize: 26, fontWeight: "700" },
    h2: { color: colors.text, fontSize: 17, fontWeight: "700" },
    body: { color: colors.text, fontSize: 15, lineHeight: 22 },
    strong: { color: colors.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
    muted: { color: colors.icon, fontSize: 14, lineHeight: 20 },
    link: { color: colors.tint, fontSize: 14, fontWeight: "600" },
    danger: { color: colors.error, fontSize: 14, fontWeight: "600" },
    error: { color: colors.error, fontSize: 14 },
    success: { color: colors.success, fontSize: 14 },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    emptyRow: { gap: 8 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
    gridItem: { flexGrow: 1, flexBasis: 280 },
    form: { gap: 14 },
    formRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    formCell: { flexGrow: 1, flexBasis: 220 },
    actionsRow: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 10 },
    switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    addressTitle: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    pillText: { color: colors.text, fontSize: 12, fontWeight: "600" },
    linkRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, paddingTop: 4 },
    emptyCard: { alignItems: "center", paddingVertical: 32 },
    backLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  });
