import {
  DAYS,
  defaultHours,
  emptyStoreInfo,
  SOCIAL_KEYS,
  SOCIAL_LABEL,
  storeOpenStatus,
  type DayHours,
  type SocialKey,
  type StoreInfo,
} from "@agestyles/api-client/store-info";
import { Button } from "@agestyles/ui-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { OperationList, Section } from "./operation-list";
import { useBusinessTheme, type BusinessTheme } from "../hooks/use-business-theme";
import { useResponsive } from "../hooks/use-responsive";
import { serverMessage } from "../lib/admin";

/**
 * «Información de la tienda» (AG-55): how the store serves orders, how to reach it, where it is,
 * when it is open and its social networks. One editor for the store's own team and for the
 * marketplace administration; the server validates everything again in Spanish.
 */
export type StoreInfoEditorProps = {
  title: string;
  subtitle: string;
  backLabel?: string;
  load: () => Promise<{ info: StoreInfo; can_edit?: boolean }>;
  save: (info: Record<string, unknown>) => Promise<{ info: StoreInfo }>;
};

type Draft = {
  pickup: boolean;
  delivery: boolean;
  deliveryNote: string;
  phones: string[];
  whatsapp: string;
  email: string;
  line: string;
  area: string;
  city: string;
  reference: string;
  lat: string;
  lng: string;
  publishHours: boolean;
  hours: DayHours[];
  socials: Record<SocialKey, string>;
};

const toDraft = (info: StoreInfo): Draft => ({
  pickup: info.fulfillment.pickup,
  delivery: info.fulfillment.delivery,
  deliveryNote: info.fulfillment.delivery_note ?? "",
  phones: info.phones.length ? [...info.phones] : [""],
  whatsapp: info.whatsapp ?? "",
  email: info.email ?? "",
  line: info.address.line ?? "",
  area: info.address.area ?? "",
  city: info.address.city ?? "",
  reference: info.address.reference ?? "",
  lat: info.location ? String(info.location.lat) : "",
  lng: info.location ? String(info.location.lng) : "",
  publishHours: info.hours !== null,
  hours: info.hours ?? defaultHours(),
  socials: Object.fromEntries(
    SOCIAL_KEYS.map((key) => [key, info.socials[key] ?? ""]),
  ) as Draft["socials"],
});

/** What the API receives; empty strings become nulls, the server normalizes the rest. */
const toPayload = (draft: Draft, timezone: string) => ({
  fulfillment: {
    pickup: draft.pickup,
    delivery: draft.delivery,
    delivery_note: draft.deliveryNote,
  },
  phones: draft.phones.filter((phone) => phone.trim()),
  whatsapp: draft.whatsapp,
  email: draft.email,
  address: {
    line: draft.line,
    area: draft.area,
    city: draft.city,
    reference: draft.reference,
  },
  location: draft.lat.trim() || draft.lng.trim() ? { lat: draft.lat, lng: draft.lng } : null,
  hours: draft.publishHours ? draft.hours : null,
  timezone,
  socials: draft.socials,
});

/** «0900» → «09:00», «9:5» → «09:05»; anything else is left for the server to reject. */
function fixTime(text: string): string {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
  return match ? `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}` : text;
}

function Field({
  label,
  value,
  onChangeText,
  editable,
  placeholder,
  keyboardType,
  hint,
  multiline,
  styles,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  editable: boolean;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  hint?: string;
  multiline?: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: BusinessTheme;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        keyboardType={keyboardType}
        autoCapitalize="none"
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline, !editable && styles.disabled]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ToggleRow({
  label,
  detail,
  value,
  onValueChange,
  editable,
  styles,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  editable: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.hint}>{detail}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={!editable}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function StoreInfoEditor({ title, subtitle, backLabel, load, save }: StoreInfoEditorProps) {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const { isWideWeb } = useResponsive();
  const [draft, setDraft] = useState<Draft>(() => toDraft(emptyStoreInfo()));
  const [timezone, setTimezone] = useState(emptyStoreInfo().timezone);
  const [canEdit, setCanEdit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await load();
      setDraft(toDraft(result.info));
      setTimezone(result.info.timezone);
      setCanEdit(result.can_edit !== false);
      setDirty(false);
    } catch (cause) {
      setError(serverMessage(cause, "No se pudo cargar la información de la tienda."));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setNotice("");
  };
  const setDay = (index: number, patch: Partial<DayHours>) =>
    change(
      "hours",
      draft.hours.map((day, position) => (position === index ? { ...day, ...patch } : day)),
    );

  async function submit() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await save(toPayload(draft, timezone));
      setDraft(toDraft(result.info));
      setDirty(false);
      setNotice("Información guardada. Ya se ve en la Tienda y en el Catálogo.");
    } catch (cause) {
      setError(serverMessage(cause, "No se pudo guardar la información. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  }

  function useMyLocation() {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) {
      setError("Este dispositivo no permite obtener la ubicación. Escribe las coordenadas.");
      return;
    }
    geo.getCurrentPosition(
      (position) => {
        setDraft((current) => ({
          ...current,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }));
        setDirty(true);
        setError("");
      },
      () =>
        setError("No se pudo obtener la ubicación. Revisa el permiso o escribe las coordenadas."),
      { timeout: 10_000 },
    );
  }

  const preview = useMemo(() => {
    if (!draft.publishHours) return null;
    const valid = draft.hours.every(
      (day) => day.closed || (/^\d\d:\d\d$/.test(day.open) && /^\d\d:\d\d$/.test(day.close)),
    );
    if (!valid) return null;
    return storeOpenStatus({ ...emptyStoreInfo(), hours: draft.hours, timezone }).label;
  }, [draft.hours, draft.publishHours, timezone]);

  const common = { editable: canEdit && !saving, styles, theme } as const;

  const atencion = (
    <Section title="Cómo atiende">
      <View style={styles.block}>
        <ToggleRow
          label="Recogida en tienda"
          detail="Los clientes pueden pasar a recoger su pedido."
          value={draft.pickup}
          onValueChange={(value) => change("pickup", value)}
          editable={common.editable}
          styles={styles}
        />
        <ToggleRow
          label="Envío a domicilio"
          detail="La tienda lleva el pedido a la dirección del cliente."
          value={draft.delivery}
          onValueChange={(value) => change("delivery", value)}
          editable={common.editable}
          styles={styles}
        />
        {draft.delivery ? (
          <Field
            {...common}
            label="Nota sobre el envío"
            value={draft.deliveryNote}
            onChangeText={(value) => change("deliveryNote", value)}
            placeholder="Ej.: Solo en La Habana, de lunes a sábado"
          />
        ) : null}
      </View>
    </Section>
  );

  const contacto = (
    <Section title="Contacto">
      <View style={styles.block}>
        {draft.phones.map((phone, index) => (
          <View key={index} style={styles.phoneRow}>
            <View style={styles.flex}>
              <Field
                {...common}
                label={index === 0 ? "Teléfono" : `Teléfono ${index + 1}`}
                value={phone}
                keyboardType="phone-pad"
                placeholder="+53 5 123 4567"
                onChangeText={(value) =>
                  change(
                    "phones",
                    draft.phones.map((item, position) => (position === index ? value : item)),
                  )
                }
              />
            </View>
            {canEdit && draft.phones.length > 1 ? (
              <Button
                title="Quitar"
                variant="secondary"
                onPress={() =>
                  change(
                    "phones",
                    draft.phones.filter((_, position) => position !== index),
                  )
                }
              />
            ) : null}
          </View>
        ))}
        {canEdit && draft.phones.length < 3 ? (
          <Button
            title="Añadir otro teléfono"
            variant="secondary"
            onPress={() => change("phones", [...draft.phones, ""])}
          />
        ) : null}
        <Field
          {...common}
          label="WhatsApp"
          value={draft.whatsapp}
          keyboardType="phone-pad"
          placeholder="+53 5 123 4567"
          hint="Con el prefijo del país. También se usa para los avisos de pedidos por WhatsApp."
          onChangeText={(value) => change("whatsapp", value)}
        />
        <Field
          {...common}
          label="Correo electrónico"
          value={draft.email}
          keyboardType="email-address"
          placeholder="tienda@ejemplo.com"
          onChangeText={(value) => change("email", value)}
        />
      </View>
    </Section>
  );

  const direccion = (
    <Section title="Dirección y ubicación">
      <View style={styles.block}>
        <Field
          {...common}
          label="Calle y número"
          value={draft.line}
          placeholder="Calle 26 #102A e/ 1ra y 3ra"
          onChangeText={(value) => change("line", value)}
        />
        <View style={styles.twoColumns}>
          <View style={styles.flex}>
            <Field
              {...common}
              label="Municipio o barrio"
              value={draft.area}
              placeholder="Miramar, Playa"
              onChangeText={(value) => change("area", value)}
            />
          </View>
          <View style={styles.flex}>
            <Field
              {...common}
              label="Provincia o ciudad"
              value={draft.city}
              placeholder="La Habana"
              onChangeText={(value) => change("city", value)}
            />
          </View>
        </View>
        <Field
          {...common}
          label="Referencia"
          value={draft.reference}
          placeholder="Al lado del antiguo DHL"
          onChangeText={(value) => change("reference", value)}
        />
        <View style={styles.twoColumns}>
          <View style={styles.flex}>
            <Field
              {...common}
              label="Latitud"
              value={draft.lat}
              keyboardType="numbers-and-punctuation"
              placeholder="23.1136"
              onChangeText={(value) => change("lat", value)}
            />
          </View>
          <View style={styles.flex}>
            <Field
              {...common}
              label="Longitud"
              value={draft.lng}
              keyboardType="numbers-and-punctuation"
              placeholder="-82.3666"
              onChangeText={(value) => change("lng", value)}
            />
          </View>
        </View>
        <Text style={styles.hint}>
          Con la ubicación, los clientes abren el punto exacto en el mapa; sin ella, se busca por la
          dirección.
        </Text>
        {canEdit ? (
          <Button title="Usar mi ubicación actual" variant="secondary" onPress={useMyLocation} />
        ) : null}
      </View>
    </Section>
  );

  const horarios = (
    <Section title="Horario">
      <View style={styles.block}>
        <ToggleRow
          label="Publicar el horario"
          detail="Los clientes verán si la tienda está abierta ahora."
          value={draft.publishHours}
          onValueChange={(value) => change("publishHours", value)}
          editable={common.editable}
          styles={styles}
        />
        {draft.publishHours ? (
          <>
            {draft.hours.map((day, index) => (
              <View key={day.day} style={styles.dayRow}>
                <Text style={styles.dayName}>{DAYS[index]}</Text>
                <Switch
                  value={!day.closed}
                  onValueChange={(open) => setDay(index, { closed: !open })}
                  disabled={!common.editable}
                  accessibilityLabel={`${DAYS[index]}: abierto`}
                />
                {day.closed ? (
                  <Text style={[styles.hint, styles.flex]}>Cerrado</Text>
                ) : (
                  <View style={[styles.timeRow, styles.flex]}>
                    <TextInput
                      value={day.open}
                      onChangeText={(value) => setDay(index, { open: value })}
                      onBlur={() => setDay(index, { open: fixTime(day.open) })}
                      editable={common.editable}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      placeholder="09:00"
                      placeholderTextColor={theme.muted}
                      accessibilityLabel={`Apertura del ${DAYS[index]}`}
                      style={[styles.input, styles.time, !common.editable && styles.disabled]}
                    />
                    <Text style={styles.hint}>a</Text>
                    <TextInput
                      value={day.close}
                      onChangeText={(value) => setDay(index, { close: value })}
                      onBlur={() => setDay(index, { close: fixTime(day.close) })}
                      editable={common.editable}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      placeholder="18:00"
                      placeholderTextColor={theme.muted}
                      accessibilityLabel={`Cierre del ${DAYS[index]}`}
                      style={[styles.input, styles.time, !common.editable && styles.disabled]}
                    />
                  </View>
                )}
              </View>
            ))}
            {canEdit ? (
              <Button
                title="Copiar el horario del lunes a todos los días"
                variant="secondary"
                onPress={() =>
                  change(
                    "hours",
                    draft.hours.map((day) => ({ ...draft.hours[0], day: day.day })),
                  )
                }
              />
            ) : null}
            <Text style={styles.hint}>
              Formato 24 horas (por ejemplo 20:00). Si cierra después de medianoche, escribe la hora
              de la madrugada: de 18:00 a 02:00. Hora de {timezone.replace("_", " ")}.
            </Text>
            {preview ? <Text style={styles.preview}>Ahora mismo se vería: {preview}</Text> : null}
          </>
        ) : null}
      </View>
    </Section>
  );

  const redes = (
    <Section title="Redes sociales y web">
      <View style={styles.block}>
        {SOCIAL_KEYS.map((key) => (
          <Field
            key={key}
            {...common}
            label={SOCIAL_LABEL[key]}
            value={draft.socials[key]}
            placeholder={key === "website" || key === "youtube" ? "https://" : "@usuario o enlace"}
            onChangeText={(value) => change("socials", { ...draft.socials, [key]: value })}
          />
        ))}
      </View>
    </Section>
  );

  return (
    <OperationList
      backLabel={backLabel}
      title={title}
      subtitle={subtitle}
      loading={loading}
      error={error}
      onRefresh={() => void refresh()}
    >
      {!canEdit ? (
        <Text style={styles.notice}>
          Solo el propietario o la administración de la tienda puede cambiar esta información.
        </Text>
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" style={styles.success}>
          {notice}
        </Text>
      ) : null}
      {isWideWeb ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {atencion}
            {contacto}
            {direccion}
          </View>
          <View style={styles.column}>
            {horarios}
            {redes}
          </View>
        </View>
      ) : (
        <>
          {atencion}
          {contacto}
          {direccion}
          {horarios}
          {redes}
        </>
      )}
      {canEdit ? (
        <View style={styles.saveBar}>
          <Button
            title={saving ? "Guardando…" : "Guardar información"}
            onPress={() => void submit()}
            loading={saving}
            disabled={saving || !dirty}
          />
          {dirty ? <Text style={styles.hint}>Hay cambios sin guardar.</Text> : null}
        </View>
      ) : null}
    </OperationList>
  );
}

const createStyles = (theme: BusinessTheme) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    columns: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
    column: { flex: 1, minWidth: 0 },
    block: { padding: 14, gap: 12 },
    field: { gap: 6 },
    label: { color: theme.text, fontSize: 14, fontWeight: "600" },
    hint: { color: theme.muted, fontSize: 12, lineHeight: 17 },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      color: theme.text,
      backgroundColor: theme.surface,
      fontSize: 15,
    },
    multiline: { minHeight: 80, paddingTop: 10, textAlignVertical: "top" },
    disabled: { opacity: 0.6 },
    toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    phoneRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
    twoColumns: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
    dayRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
    dayName: { width: 84, color: theme.text, fontSize: 14, textTransform: "capitalize" },
    timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    time: { width: 84, textAlign: "center" },
    preview: { color: theme.successText, fontSize: 13, fontWeight: "600" },
    notice: { color: theme.muted, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    success: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    saveBar: { marginTop: 20, gap: 8, maxWidth: 360 },
  });
