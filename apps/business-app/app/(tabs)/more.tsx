import { useOptionalNotifications } from "@agestyles/features-notifications";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { OperationList, Row, Section } from "../../components/operation-list";
import { Seller, useBusiness } from "../../context/business-context";
import { useAdmin } from "../../context/admin-context";
import { useBusinessTheme } from "../../hooks/use-business-theme";
import { memberDisplayName, memberRoleLabel } from "../../lib/roles";

export default function MoreScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { seller, sellers, member, selectSeller, logout } = useBusiness();
  const unread = useOptionalNotifications()?.unreadCount ?? 0;
  const { admin } = useAdmin();
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
  const role = memberRoleLabel(member);
  return (
    <OperationList
      title="Más"
      subtitle="Cuenta y tiendas a las que tienes acceso."
      loading={false}
      error=""
    >
      <Section title="Sesión de negocio">
        <Row
          title={memberDisplayName(member)}
          detail={`${member?.member?.email ?? ""}${member?.member?.email ? " · " : ""}${role}`}
        />
        <Row
          title={seller?.name ?? "Tienda"}
          detail={`${role} · ${seller?.handle ? `@${seller.handle}` : "AgeStyles"}`}
        />
        <Row
          title="Perfil de la tienda"
          detail="Logo, portada y descripción que ven los compradores."
          action={() => router.push("/store-profile")}
        />
        <Row
          title="Portada de mi tienda"
          detail="Carrusel y productos destacados de tu página en la Tienda."
          action={() => router.push("/store-home")}
        />
        <Row
          title="Secciones de mi tienda"
          detail="Agrupa tus productos en tu página de la Tienda."
          action={() => router.push("/store-sections")}
        />
        <Row
          title="Solicitar categoría"
          detail="Propón una categoría nueva para todo el catálogo."
          action={() => router.push("/category-requests")}
        />
        {member?.is_owner || member?.permissions?.members === "manage" ? (
          <Row
            title="Equipo y permisos"
            detail="Invita personas y administra su acceso."
            action={() => router.push("/(tabs)/team")}
          />
        ) : null}
        <Row
          title="Análisis"
          detail="Ventas, más vendidos, stock por agotarse y pedidos por atender."
          action={() => router.push("/analytics")}
        />
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
      {admin ? (
        <Section title="Administración del marketplace">
          <Row
            title="Usuarios"
            detail="Administradores, clientes y miembros de todas las tiendas."
            action={() => router.push("/admin/usuarios")}
          />
          <Row
            title="Tiendas"
            detail="Estado, equipo y aprobación de cada tienda."
            action={() => router.push("/admin/tiendas")}
          />
          <Row
            title="Avisos de administración"
            detail="Tiendas por aprobar, productos por revisar, pagos y categorías."
            action={() => router.push("/admin/avisos")}
          />
          <Row
            title="Pedidos del marketplace"
            detail="Todos los pedidos y los pagos por verificar."
            action={() => router.push("/admin/pedidos")}
          />
          <Row
            title="Productos en revisión"
            detail="Altas y cambios de producto pendientes de aprobar."
            action={() => router.push("/admin/revision")}
          />
          <Row
            title="Portada de la Tienda"
            detail="Banners de la página inicial y productos destacados."
            action={() => router.push("/admin/portada")}
          />
          <Row
            title="Codificadores"
            detail="Categorías, tallas y marcas del catálogo."
            action={() => router.push("/admin/codificadores")}
          />
          <Row
            title="Mantenimiento"
            detail="Cerrar la Tienda y el Catálogo mientras trabajáis."
            action={() => router.push("/admin/mantenimiento")}
          />
          <Row
            title="Solicitudes de categoría"
            detail="Categorías que piden las tiendas."
            action={() => router.push("/admin/categorias")}
          />
        </Section>
      ) : null}
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
          action={() => router.push("/tienda")}
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
