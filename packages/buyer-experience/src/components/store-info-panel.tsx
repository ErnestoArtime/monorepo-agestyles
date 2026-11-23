import {
  addressLine,
  emailHref,
  fulfillmentSummary,
  getPublicStoreInfo,
  hoursSummary,
  mapsHref,
  phoneHref,
  SOCIAL_KEYS,
  SOCIAL_LABEL,
  storeOpenStatus,
  whatsappHref,
  type StoreInfo,
} from "@agestyles/api-client/store-info";
import { Icon, type IconName } from "@agestyles/icons";
import { SkeletonBlock } from "@agestyles/ui-native";
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { sdk } from "../config";
import { Colors } from "../constants/theme";
import { useColorScheme } from "../hooks/use-color-scheme";
import { useResponsive } from "../hooks/use-responsive";

type Palette = (typeof Colors)[keyof typeof Colors];

const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/**
 * The public «Información» of a store (AG-55) on its page: whether it is open now and how it
 * serves orders at a glance, and — opened — pickup/delivery, hours, contacts, address with a map
 * link and social networks. Renders nothing when the store published no information.
 */
export function StoreInfoPanel({ sellerId }: { sellerId: string }) {
  const colors = Colors[useColorScheme() ?? "light"];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isWideWeb } = useResponsive();
  const [info, setInfo] = useState<StoreInfo | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    setInfo(undefined);
    getPublicStoreInfo(sdk.client, { sellerId }).then((result) => {
      if (active) setInfo(result);
    });
    return () => {
      active = false;
    };
  }, [sellerId]);

  // «Abierto ahora» stays right while the page is left open.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (info === null) return null;
  if (info === undefined) {
    return (
      <View style={styles.card} accessibilityLabel="Cargando la información de la tienda">
        <SkeletonBlock width="55%" height={16} />
        <SkeletonBlock width="35%" height={12} />
      </View>
    );
  }

  const status = info.hours ? storeOpenStatus(info, now) : null;
  const fulfillment = fulfillmentSummary(info);
  const address = addressLine(info);
  const map = mapsHref(info);
  const hours = hoursSummary(info.hours);
  const socials = SOCIAL_KEYS.filter((key) => info.socials[key]);
  const showFull = expanded || isWideWeb;

  const row = (icon: IconName, content: React.ReactNode) => (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={colors.tint} />
      <View style={styles.rowBody}>{content}</View>
    </View>
  );
  const link = (label: string, url: string, hint?: string) => (
    <Pressable
      key={url}
      onPress={() => open(url)}
      accessibilityRole="link"
      accessibilityLabel={hint ?? label}
    >
      {({ hovered }: { hovered?: boolean; pressed: boolean }) => (
        <Text style={[styles.link, hovered && styles.linkHover]}>{label}</Text>
      )}
    </Pressable>
  );

  return (
    <View style={styles.card} accessibilityLabel="Información de la tienda">
      <View style={styles.summary}>
        {status ? (
          <View style={styles.chip}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    status.state === "open"
                      ? colors.success
                      : status.state === "closed"
                        ? colors.error
                        : colors.icon,
                },
              ]}
            />
            <Text style={styles.chipText}>{status.label}</Text>
          </View>
        ) : null}
        {info.fulfillment.pickup ? (
          <View style={styles.chip}>
            <Icon name="store" size={14} color={colors.tint} />
            <Text style={styles.chipText}>Recogida</Text>
          </View>
        ) : null}
        {info.fulfillment.delivery ? (
          <View style={styles.chip}>
            <Icon name="truck" size={14} color={colors.tint} />
            <Text style={styles.chipText}>Envío a domicilio</Text>
          </View>
        ) : null}
        {!isWideWeb ? (
          <Pressable
            onPress={() => setExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            style={styles.toggle}
          >
            <Text style={styles.link}>{expanded ? "Ocultar información" : "Ver información"}</Text>
            <Icon name={expanded ? "chevronUp" : "chevronDown"} size={16} color={colors.tint} />
          </Pressable>
        ) : null}
      </View>

      {showFull ? (
        <View style={[styles.detail, isWideWeb && styles.detailWide]}>
          <View style={styles.column}>
            {fulfillment
              ? row(
                  "truck",
                  <>
                    <Text style={styles.strong}>{fulfillment}</Text>
                    {info.fulfillment.delivery_note ? (
                      <Text style={styles.muted}>{info.fulfillment.delivery_note}</Text>
                    ) : null}
                  </>,
                )
              : null}
            {hours.length
              ? row(
                  "list",
                  <>
                    <Text style={styles.strong}>Horario</Text>
                    {hours.map((line) => (
                      <Text key={line.days} style={styles.muted}>
                        {line.days}: {line.hours}
                      </Text>
                    ))}
                  </>,
                )
              : null}
            {address
              ? row(
                  "mapPin",
                  <>
                    <Text style={styles.strong}>{address}</Text>
                    {info.address.reference ? (
                      <Text style={styles.muted}>{info.address.reference}</Text>
                    ) : null}
                    {map ? link("Cómo llegar", map, "Cómo llegar, abre el mapa") : null}
                  </>,
                )
              : null}
          </View>
          <View style={styles.column}>
            {info.phones.length || info.whatsapp || info.email
              ? row(
                  "phone",
                  <>
                    <Text style={styles.strong}>Contacto</Text>
                    {info.phones.map((phone) =>
                      link(phone, phoneHref(phone), `Llamar al ${phone}`),
                    )}
                    {info.whatsapp
                      ? link("WhatsApp", whatsappHref(info.whatsapp), "Escribir por WhatsApp")
                      : null}
                    {info.email ? link(info.email, emailHref(info.email)) : null}
                  </>,
                )
              : null}
            {socials.length
              ? row(
                  "share",
                  <>
                    <Text style={styles.strong}>Redes sociales</Text>
                    <View style={styles.socials}>
                      {socials.map((key) =>
                        link(
                          SOCIAL_LABEL[key],
                          info.socials[key] as string,
                          `${SOCIAL_LABEL[key]} de la tienda`,
                        ),
                      )}
                    </View>
                  </>,
                )
              : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      gap: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    summary: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
    },
    chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
    dot: { width: 8, height: 8, borderRadius: 4 },
    toggle: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
    detail: { gap: 16 },
    detailWide: { flexDirection: "row", alignItems: "flex-start", gap: 32 },
    column: { flex: 1, minWidth: 0, gap: 14 },
    row: { flexDirection: "row", gap: 12 },
    rowBody: { flex: 1, minWidth: 0, gap: 3 },
    strong: { color: colors.text, fontSize: 15, fontWeight: "600" },
    muted: { color: colors.icon, fontSize: 14, lineHeight: 20 },
    link: { color: colors.tint, fontSize: 14, fontWeight: "600" },
    linkHover: { textDecorationLine: "underline" },
    socials: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  });
