import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@agestyles/icons";
import { OperationList, palette, Row, Section } from "../../components/operation-list";
import { Seller, useBusiness } from "../../context/business-context";

export default function MoreScreen() {
  const router = useRouter();
  const { seller, sellers, member, selectSeller, logout } = useBusiness();
  async function switchTo(item: Seller) {
    try { await selectSeller(item); }
    catch (cause) { Alert.alert("No se pudo cambiar de tienda", cause instanceof Error ? cause.message : "Vuelve a intentarlo."); }
  }
  async function signOut() { await logout(); router.replace("/"); }
  const role = member?.is_owner ? "Propietario" : member?.role_id?.includes("INVENTORY") || member?.role_id?.includes("inventory") ? "Gestor de inventario" : member?.role_id?.toLowerCase().includes("support") ? "Solo lectura" : "Miembro";
  return <OperationList title="Más" subtitle="Cuenta y tiendas a las que tienes acceso." loading={false} error="">
    <Section title="Sesión de negocio">
      <Row title={seller?.name ?? "Tienda"} detail={`${role} · ${seller?.handle ? `@${seller.handle}` : "AgeStyles"}`} />
      {member?.is_owner || member?.permissions?.members === "manage" ? <Row title="Equipo y permisos" detail="Invita personas y administra su acceso." action={() => router.push("/(tabs)/team")} /> : null}
      <Row title="Cerrar sesión" detail="Salir de la cuenta de negocio" action={() => void signOut()} />
    </Section>
    <Section title="Experiencia AgeStyles">
      <Row title="Comprar" detail="Explora la tienda como cliente sin cerrar tu sesión de negocio." action={() => router.push("/(buyer)")} />
    </Section>
    {sellers.length > 1 ? <Section title="Cambiar de tienda">
      {sellers.filter((item) => item.id !== seller?.id).map((item) => <Pressable key={item.id} onPress={() => void switchTo(item)} style={({ pressed }) => [styles.choice, pressed && { opacity: 0.65 }]} accessibilityRole="button">
        <View style={styles.storeIcon}><Icon name="store" color={palette.navy} size={19} /></View><View style={{ flex: 1 }}><Text style={styles.choiceTitle}>{item.name}</Text><Text style={styles.choiceSub}>{item.handle ? `@${item.handle}` : "Tienda AgeStyles"}</Text></View><Icon name="chevronRight" color={palette.muted} size={18} />
      </Pressable>)}
    </Section> : null}
    <View style={styles.notice}><Icon name="shieldCheck" color={palette.navy} /><Text style={styles.noticeText}>Cambiar de tienda vuelve a consultar los permisos del servidor.</Text></View>
  </OperationList>;
}

const styles = StyleSheet.create({ choice: { minHeight: 66, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomColor: palette.line, borderBottomWidth: StyleSheet.hairlineWidth }, storeIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: palette.paper, alignItems: "center", justifyContent: "center" }, choiceTitle: { color: palette.ink, fontSize: 14, fontWeight: "500" }, choiceSub: { color: palette.muted, fontSize: 12, marginTop: 3 }, notice: { marginTop: 19, padding: 15, backgroundColor: "#E9EBEE", borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 10 }, noticeText: { color: palette.navy, flex: 1, fontSize: 13, lineHeight: 19 } });
