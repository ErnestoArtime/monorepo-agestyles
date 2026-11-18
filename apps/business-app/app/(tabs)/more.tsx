import { useOptionalNotifications } from "@agestyles/features-notifications";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { OperationList, Row, Section } from "../../components/operation-list";
import { Seller, useBusiness } from "../../context/business-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";

export default function MoreScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { seller, sellers, member, selectSeller, logout } = useBusiness();
  const unread = useOptionalNotifications()?.unreadCount ?? 0;
  async function switchTo(item: Seller) {
    try {
      await selectSeller(item);
    } catch {
      Alert.alert("No se pudo cambiar de tienda", "Vuelve a intentarlo.");
    }
  }
  async function signOut() {
    await logout();
    router.replace("/");
  }
  const role = member?.is_owner
    ? "Propietario"
    : member?.role_id?.includes("INVENTORY") || member?.role_id?.includes("inventory")
      ? "Gestor de inventario"
      : member?.role_id?.toLowerCase().includes("support")
        ? "Solo lectura"
        : "Miembro";
  return (
    <OperationList
      title="Más"
      subtitle="Cuenta y tiendas a las que tienes acceso."
      loading={false}
      error=""
    >
      <Section title="Sesión de negocio">
        <Row
          title={seller?.name ?? "Tienda"}
          detail={`${role} · ${seller?.handle ? `@${seller.handle}` : "AgeStyles"}`}
        />
        {member?.is_owner || member?.permissions?.members === "manage" ? (
          <Row
            title="Equipo y permisos"
            detail="Invita personas y administra su acceso."
            action={() => router.push("/(tabs)/team")}
          />
        ) : null}
        <Row
          title="Comisiones"
          detail="Gestores de venta, ventas registradas, saldo y retiros."
          action={() => router.push("/commissions")}
        />
        <Row
          title="Cerrar sesión"
          detail="Salir de la cuenta de negocio"
          action={() => void signOut()}
        />
      </Section>
      <Section title="Avisos">
        <Row
          title="Notificaciones"
          detail="Novedades de los pedidos, pagos e inventario de tu tienda."
          trailing={unread > 0 ? `${unread} sin leer` : undefined}
          action={() => router.push("/notifications")}
        />
        <Row
          title="Avisos"
          detail="Elige qué avisos recibes y cómo."
          action={() => router.push("/notification-preferences")}
        />
      </Section>
      <Section title="Experiencia AgeStyles">
        <Row
          title="Comprar"
          detail="Explora la tienda como cliente sin cerrar tu sesión de negocio."
          action={() => router.push("/(buyer)")}
        />
      </Section>
      {sellers.length > 1 ? (
        <Section title="Cambiar de tienda">
          {sellers
            .filter((item) => item.id !== seller?.id)
            .map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void switchTo(item)}
                style={({ pressed }) => [styles.choice, pressed && { opacity: 0.65 }]}
                accessibilityRole="button"
              >
                <View style={styles.storeIcon}>
                  <Icon name="store" color={theme.action} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceTitle}>{item.name}</Text>
                  <Text style={styles.choiceSub}>
                    {item.handle ? `@${item.handle}` : "Tienda AgeStyles"}
                  </Text>
                </View>
                <Icon name="chevronRight" color={theme.muted} size={20} />
              </Pressable>
            ))}
        </Section>
      ) : null}
      <View style={styles.notice}>
        <Icon name="shieldCheck" color={theme.action} />
        <Text style={styles.noticeText}>
          Cambiar de tienda vuelve a consultar los permisos del servidor.
        </Text>
      </View>
    </OperationList>
  );
}

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    choice: {
      minHeight: 66,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    storeIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: theme.quietSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    choiceTitle: { color: theme.text, fontSize: 14, fontWeight: "500" },
    choiceSub: { color: theme.muted, fontSize: 12, marginTop: 3 },
    notice: {
      marginTop: 19,
      padding: 15,
      backgroundColor: theme.quietSurface,
      borderRadius: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    noticeText: { color: theme.text, flex: 1, fontSize: 13, lineHeight: 19 },
  });
