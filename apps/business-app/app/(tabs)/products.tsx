import { useCallback, useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useBusiness } from "../../context/business-context"
import { hasPermission, OperationList, palette, Row, Section } from "../../components/operation-list"

type SellerProduct = {
  id: string
  title: string
  description?: string | null
  status?: string
  variants?: { id: string; title?: string }[]
}

type ProductChangeResponse = {
  product_change?: { id: string; status?: string }
}

export default function ProductsScreen() {
  const { request, seller, member } = useBusiness()
  const [items, setItems] = useState<SellerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const canEdit = hasPermission(member, "products", "edit")

  const load = useCallback(async () => {
    if (!seller) return
    setLoading(true)
    setError("")
    try {
      const data = await request<{ products?: SellerProduct[] }>(
        "/vendor/products?limit=50&fields=id,title,description,status,variants.id,variants.title",
      )
      setItems(data?.products ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar el catálogo de esta tienda.")
    } finally {
      setLoading(false)
    }
  }, [request, seller])

  useEffect(() => { void load() }, [load])

  function beginEdit(item: SellerProduct) {
    if (!canEdit) return
    setNotice("")
    setError("")
    setEditingId(item.id)
    setTitle(item.title ?? "")
    setDescription(item.description ?? "")
  }

  function cancelEdit() {
    setEditingId(null)
    setTitle("")
    setDescription("")
  }

  async function submitChange(item: SellerProduct) {
    const nextTitle = title.trim()
    if (!nextTitle) {
      setError("El nombre del producto no puede quedar vacío.")
      return
    }

    const update: { title?: string; description?: string } = {}
    if (nextTitle !== item.title) update.title = nextTitle
    if (description !== (item.description ?? "")) update.description = description
    if (Object.keys(update).length === 0) {
      setNotice("No hay cambios para enviar.")
      cancelEdit()
      return
    }

    setSaving(true)
    setError("")
    setNotice("")
    try {
      const result = await request<ProductChangeResponse>(`/vendor/products/${item.id}`, "POST", update)
      const changeId = result?.product_change?.id
      setNotice(
        changeId
          ? "Cambios enviados a AgeStyles para revisión. El producto actual sigue visible sin cambios hasta su aprobación."
          : "La solicitud de cambios se envió para revisión.",
      )
      cancelEdit()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo enviar el producto a revisión.")
    } finally {
      setSaving(false)
    }
  }

  return <OperationList
    title="Productos"
    subtitle={canEdit ? "Consulta el catálogo y envía cambios para revisión." : "Consulta el catálogo disponible para tu rol."}
    loading={loading}
    error={error}
    empty="Esta tienda todavía no tiene productos visibles."
    onRefresh={() => void load()}
  >
    {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    {items.length ? <Section title={`${items.length} productos`}>
      {items.map((item) => <View key={item.id} style={styles.product}>
        <Row
          title={item.title ?? "Producto sin título"}
          detail={`${item.variants?.length ?? 0} variantes · ${item.status ?? "Sin estado"}`}
          action={canEdit ? () => beginEdit(item) : undefined}
        />
        {editingId === item.id ? <View style={styles.editor}>
          <Text style={styles.label}>Nombre del producto</Text>
          <TextInput
            accessibilityLabel="Nombre del producto"
            value={title}
            onChangeText={setTitle}
            editable={!saving}
            maxLength={200}
            placeholder="Nombre del producto"
            placeholderTextColor={palette.muted}
            style={styles.input}
          />
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            accessibilityLabel="Descripción del producto"
            value={description}
            onChangeText={setDescription}
            editable={!saving}
            multiline
            maxLength={5000}
            textAlignVertical="top"
            placeholder="Describe el producto"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.description]}
          />
          <View style={styles.actions}>
            <Pressable
              onPress={cancelEdit}
              disabled={saving}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, saving && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => void submitChange(item)}
              disabled={saving || !title.trim()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (saving || !title.trim()) && styles.disabled]}
            >
              <Text style={styles.primaryText}>{saving ? "Enviando…" : "Enviar a revisión"}</Text>
            </Pressable>
          </View>
        </View> : null}
      </View>)}
    </Section> : null}
    {!canEdit && items.length ? <Text style={styles.readOnlyNote}>Tu rol permite consultar productos, pero no enviar cambios.</Text> : null}
  </OperationList>
}

const styles = StyleSheet.create({
  product: { borderBottomWidth: 1, borderBottomColor: palette.line },
  editor: { gap: 9, paddingHorizontal: 15, paddingBottom: 16 },
  label: { color: palette.ink, fontSize: 13, fontWeight: "600" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: palette.white,
    color: palette.ink,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
  },
  description: { minHeight: 112 },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 9, marginTop: 4 },
  primaryButton: { minHeight: 44, justifyContent: "center", borderRadius: 12, paddingHorizontal: 16, backgroundColor: palette.navy },
  primaryText: { color: palette.white, fontSize: 14, fontWeight: "700" },
  secondaryButton: { minHeight: 44, justifyContent: "center", borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white },
  secondaryText: { color: palette.ink, fontSize: 14, fontWeight: "600" },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
  notice: { marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.white, color: palette.ink, padding: 12, lineHeight: 20 },
  readOnlyNote: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 10 },
})
