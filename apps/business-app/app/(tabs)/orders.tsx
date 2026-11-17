import { useCallback, useEffect, useState } from "react";
import { OperationList, Row, Section } from "../../components/operation-list";
import { useBusiness } from "../../context/business-context";

export default function OrdersScreen() {
  const { request, seller } = useBusiness();
  const [items, setItems] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true); setError("");
    try { const data = await request<any>("/vendor/orders?limit=50&fields=id,display_id,status,created_at,currency_code,total"); setItems(data?.orders ?? []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Tu rol no puede consultar los pedidos de esta tienda."); }
    finally { setLoading(false); }
  }, [request, seller]);
  useEffect(() => { void load(); }, [load]);
  return <OperationList title="Pedidos" subtitle="Pedidos propios de la tienda seleccionada." loading={loading} error={error} empty="No hay pedidos para mostrar." onRefresh={() => void load()}>
    {items.length ? <Section title={`${items.length} pedidos`}>
      {items.map((item) => <Row key={item.id} title={`Pedido ${item.display_id ?? item.id.slice(-6)}`} detail={`${item.status ?? "Pendiente"} · ${item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}`} trailing={item.total != null ? `${item.currency_code?.toUpperCase() ?? ""} ${item.total}` : undefined} />)}
    </Section> : null}
  </OperationList>;
}
