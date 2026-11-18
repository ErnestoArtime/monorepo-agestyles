import { Icon } from "@agestyles/icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { OperationList, Section } from "../components/operation-list";
import { Button, PillGroup, StatusBadge, type BadgeTone } from "@agestyles/ui-native";
import { deliverCsv } from "../lib/inventory-movements";
import { useBusiness } from "../context/business-context";
import { useBusinessTheme } from "../hooks/use-business-theme";
import {
  COMMISSIONS,
  commissionError,
  money,
  PAYMENT_LABEL,
  ruleLabel,
  shortDate,
  WITHDRAWAL_LABEL,
  type AgentSale,
  type Balance,
  type CommissionRule,
  type SalesAgent,
  type Withdrawal,
} from "../lib/commissions";

type Member = { id: string; member?: { id?: string; email?: string } };
type Product = { id: string; title?: string };

type ReportPeriod = "7" | "30" | "90";
const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
];
const COMMISSIONS_REPORT = "/vendor/agestyles/commissions/report";
const COMMISSIONS_EXPORT = "/vendor/agestyles/agent-sales/export";

type SalesReport = {
  totals: { count: number; total: number; commission: number };
  days: { date: string; count: number; total: number }[];
  agents: { agent_id: string; count: number; total: number; commission: number }[];
  products: { product_id: string; title: string | null; units: number; total: number }[];
};

/** `from`/`to` (UTC dates) for the last N days, today included. */
function periodQuery(period: ReportPeriod) {
  const to = new Date();
  const from = new Date(to.getTime() - (Number(period) - 1) * 24 * 60 * 60 * 1000);
  return `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;
}

function shortDay(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function CommissionsScreen() {
  const theme = useBusinessTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { request, requestText, seller } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [ownAgentId, setOwnAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [sales, setSales] = useState<AgentSale[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // Forms
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [newCode, setNewCode] = useState("");
  const [generalPercent, setGeneralPercent] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [ruleProductId, setRuleProductId] = useState("");
  const [ruleKind, setRuleKind] = useState<"percent" | "fixed">("fixed");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleThreshold, setRuleThreshold] = useState("");
  // Manager report (AG-06 phase 3)
  const [period, setPeriod] = useState<ReportPeriod>("30");
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [exporting, setExporting] = useState(false);

  const productTitle = useMemo(
    () => new Map(products.map((product) => [product.id, product.title ?? "Producto"])),
    [products],
  );
  const agentEmail = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.member_email ?? agent.code])),
    [agents],
  );

  const load = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    setError("");
    try {
      const who = await request<{
        sales_agents: SalesAgent[];
        is_manager: boolean;
        own_agent_id: string | null;
      }>(COMMISSIONS.agents);
      setIsManager(who.is_manager);
      setOwnAgentId(who.own_agent_id);
      setAgents(who.sales_agents);
      if (!who.is_manager && !who.own_agent_id) {
        setError("Esta sección es para gestores de venta y para el titular de la tienda.");
        return;
      }
      const [ruleData, saleData, withdrawalData, productData] = await Promise.all([
        request<{ commission_rules: CommissionRule[] }>(COMMISSIONS.rules),
        request<{ agent_sales: AgentSale[] }>(`${COMMISSIONS.sales}?limit=100`),
        request<{ commission_withdrawals: Withdrawal[] }>(COMMISSIONS.withdrawals),
        request<{ products: Product[] }>("/vendor/products?limit=100&fields=id,title"),
      ]);
      setRules(ruleData.commission_rules);
      setSales(saleData.agent_sales);
      setWithdrawals(withdrawalData.commission_withdrawals);
      setProducts(productData.products ?? []);
      setBalance(who.own_agent_id ? await request<Balance>(COMMISSIONS.balance) : null);
      if (who.is_manager) {
        const memberData = await request<{ seller_members: Member[] }>(
          `/vendor/sellers/${seller.id}/members?limit=50&fields=id,member.id,member.email`,
        );
        setMembers(memberData.seller_members ?? []);
        const general = ruleData.commission_rules.find((rule) => !rule.product_id);
        setGeneralPercent(general ? String(Number(general.value)) : "");
      }
    } catch (cause) {
      setError(commissionError(cause, "No se pudieron cargar las comisiones."));
    } finally {
      setLoading(false);
    }
  }, [request, seller]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, action: () => Promise<unknown>, done: string, fallback: string) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(done);
      await load();
      return true;
    } catch (cause) {
      setError(commissionError(cause, fallback));
      return false;
    } finally {
      setBusy("");
    }
  }

  const ownSales = sales.filter((sale) => sale.agent_id === ownAgentId);
  const ownWithdrawals = withdrawals.filter((item) => item.agent_id === ownAgentId);
  const pending = withdrawals.filter((item) => item.status === "requested");
  const productRules = rules.filter((rule) => rule.product_id);
  const memberOptions = members.filter(
    (person) => person.member?.id && !agents.some((agent) => agent.member_id === person.member?.id),
  );
  const matchingProducts = productQuery.trim()
    ? products
        .filter((product) =>
          (product.title ?? "").toLowerCase().includes(productQuery.trim().toLowerCase()),
        )
        .slice(0, 6)
    : [];
  useEffect(() => {
    if (!isManager || !seller) return;
    let current = true;
    request<{ report: SalesReport }>(`${COMMISSIONS_REPORT}?${periodQuery(period)}`)
      .then((data) => current && setSalesReport(data.report))
      .catch(() => current && setSalesReport(null));
    return () => {
      current = false;
    };
  }, [isManager, period, request, seller, sales]);

  async function exportSales() {
    setExporting(true);
    setError("");
    try {
      const csv = await requestText(`${COMMISSIONS_EXPORT}?${periodQuery(period)}`);
      await deliverCsv(csv, `ventas-gestores-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (cause) {
      setError(commissionError(cause, "No se pudo exportar las ventas."));
    } finally {
      setExporting(false);
    }
  }

  const bestDay = Math.max(1, ...(salesReport?.days ?? []).map((day) => day.total));

  return (
    <OperationList
      title="Comisiones"
      subtitle={
        isManager
          ? "Gestores de venta, reglas de comisión y retiros en efectivo."
          : "Tus ventas, tu saldo y tus retiros en efectivo."
      }
      loading={loading}
      error={error}
      onRefresh={() => void load()}
    >
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={styles.back}
      >
        <Icon name="arrowLeft" size={18} color={theme.action} />
        <Text style={styles.link}>Volver</Text>
      </Pressable>
      {notice ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      {ownAgentId && balance ? (
        <>
          <Section title="Mi saldo">
            <View style={styles.block}>
              <View style={styles.figures}>
                <Figure
                  label="Disponible"
                  value={money(balance.available)}
                  styles={styles}
                  strong
                />
                <Figure label="Saldo" value={money(balance.balance)} styles={styles} />
                <Figure label="Solicitado" value={money(balance.requested)} styles={styles} />
              </View>
              <Button
                icon="shoppingCart"
                title="Registrar venta"
                onPress={() => router.push("/agent-sale")}
              />
              <Text style={styles.label}>Retirar en efectivo (USD)</Text>
              <View style={styles.inline}>
                <TextInput
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  accessibilityLabel="Importe a retirar"
                  placeholder="0,00"
                  placeholderTextColor={theme.placeholderText}
                  style={[styles.input, styles.flex]}
                />
                <Pressable
                  disabled={busy === "withdraw"}
                  onPress={async () => {
                    const amount = Number(withdrawAmount.replace(",", "."));
                    if (
                      await run(
                        "withdraw",
                        () => request(COMMISSIONS.withdrawals, "POST", { amount }),
                        "Retiro solicitado. El titular confirmará la entrega.",
                        "No se pudo solicitar el retiro.",
                      )
                    )
                      setWithdrawAmount("");
                  }}
                  accessibilityRole="button"
                  style={[styles.secondary, busy === "withdraw" && styles.disabled]}
                >
                  <Text style={styles.link}>Solicitar</Text>
                </Pressable>
              </View>
              {balance.progress.map((item) => (
                <Text key={item.product_id} style={styles.muted}>
                  {productTitle.get(item.product_id) ?? "Producto"}: {item.units_sold} vendidas,
                  faltan {item.units_to_next} para la próxima comisión.
                </Text>
              ))}
            </View>
          </Section>
          <Section title="Mis ventas">
            {ownSales.length ? (
              ownSales
                .slice(0, 20)
                .map((sale) => <SaleRow key={sale.id} sale={sale} styles={styles} />)
            ) : (
              <Text style={[styles.muted, styles.pad]}>Aún no has registrado ventas.</Text>
            )}
          </Section>
          {ownWithdrawals.length ? (
            <Section title="Mis retiros">
              {ownWithdrawals.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{money(item.amount)}</Text>
                    <Text style={styles.muted}>{shortDate(item.created_at)}</Text>
                  </View>
                  <StatusBadge
                    label={WITHDRAWAL_LABEL[item.status]}
                    tone={WITHDRAWAL_TONE[item.status]}
                  />
                </View>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}

      {isManager ? (
        <>
          <Section title={`Retiros pendientes (${pending.length})`}>
            {pending.length ? (
              pending.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{money(item.amount)}</Text>
                    <Text style={styles.muted}>
                      {agentEmail.get(item.agent_id) ?? "Gestor"} · {shortDate(item.created_at)}
                    </Text>
                  </View>
                  <Pressable
                    disabled={!!busy}
                    onPress={() =>
                      void run(
                        item.id,
                        () =>
                          request(`${COMMISSIONS.withdrawals}/${item.id}`, "POST", {
                            status: "paid",
                          }),
                        "Entrega en efectivo confirmada.",
                        "No se pudo confirmar la entrega.",
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Confirmar entrega de ${money(item.amount)}`}
                    style={styles.secondary}
                  >
                    <Text style={styles.link}>Entregado</Text>
                  </Pressable>
                  <Pressable
                    disabled={!!busy}
                    onPress={() =>
                      void run(
                        item.id,
                        () =>
                          request(`${COMMISSIONS.withdrawals}/${item.id}`, "POST", {
                            status: "rejected",
                          }),
                        "Retiro rechazado.",
                        "No se pudo rechazar el retiro.",
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Rechazar retiro de ${money(item.amount)}`}
                    style={styles.secondary}
                  >
                    <Text style={styles.danger}>Rechazar</Text>
                  </Pressable>
                </View>
              ))
            ) : (
              <Text style={[styles.muted, styles.pad]}>No hay retiros pendientes.</Text>
            )}
          </Section>

          <Section title="Informe de ventas">
            <View style={styles.block}>
              <PillGroup
                accessibilityLabel="Periodo del informe"
                value={period}
                onChange={setPeriod}
                options={REPORT_PERIODS}
              />
              {salesReport ? (
                <View style={styles.figures}>
                  <Figure label="Ventas" value={String(salesReport.totals.count)} styles={styles} />
                  <Figure
                    label="Ingresos"
                    value={money(salesReport.totals.total)}
                    styles={styles}
                    strong
                  />
                  <Figure
                    label="Comisiones"
                    value={money(salesReport.totals.commission)}
                    styles={styles}
                  />
                </View>
              ) : (
                <Text style={styles.muted}>Cargando el informe…</Text>
              )}
              <Button
                icon="arrowDown"
                variant="secondary"
                title={exporting ? "Exportando…" : "Exportar ventas (CSV)"}
                disabled={exporting}
                onPress={() => void exportSales()}
              />
            </View>
            {salesReport?.days.length ? (
              <View style={styles.block}>
                <Text style={styles.label}>Ingresos por día</Text>
                {salesReport.days
                  .slice(-14)
                  .reverse()
                  .map((day) => (
                    <View
                      key={day.date}
                      style={styles.dayRow}
                      accessibilityLabel={`${shortDay(day.date)}: ${money(day.total)} en ${day.count} ventas`}
                    >
                      <Text style={[styles.muted, styles.dayLabel]}>{shortDay(day.date)}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            { width: `${Math.max(4, (day.total / bestDay) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={[styles.rowTitle, styles.dayValue]}>{money(day.total)}</Text>
                    </View>
                  ))}
              </View>
            ) : null}
            {salesReport ? (
              <View style={styles.block}>
                <Text style={styles.label}>Ranking de gestores</Text>
                {salesReport.agents.length ? (
                  salesReport.agents.map((row, index) => (
                    <View key={row.agent_id} style={styles.rankRow}>
                      <Text style={styles.rank}>{index + 1}</Text>
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle}>
                          {agentEmail.get(row.agent_id) ?? "Gestor"}
                        </Text>
                        <Text style={styles.muted}>
                          {row.count} ventas · {money(row.total)}
                        </Text>
                      </View>
                      <Text style={styles.rowTitle}>{money(row.commission)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>Sin ventas en este periodo.</Text>
                )}
                <Text style={[styles.label, styles.spaced]}>Productos más vendidos</Text>
                {salesReport.products.length ? (
                  salesReport.products.map((row, index) => (
                    <View key={row.product_id} style={styles.rankRow}>
                      <Text style={styles.rank}>{index + 1}</Text>
                      <View style={styles.flex}>
                        <Text style={styles.rowTitle}>
                          {row.title ?? productTitle.get(row.product_id) ?? "Producto"}
                        </Text>
                        <Text style={styles.muted}>
                          {row.units} uds · {money(row.total)}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>Sin ventas en este periodo.</Text>
                )}
              </View>
            ) : null}
          </Section>

          <Section title="Gestores de venta">
            {agents.map((agent) => (
              <View key={agent.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{agent.member_email ?? "Miembro"}</Text>
                  <StatusBadge
                    label={agent.active ? "Activo" : "Inactivo"}
                    tone={agent.active ? "success" : "neutral"}
                  />
                  <Text style={styles.muted}>Código {agent.code}</Text>
                </View>
                <Pressable
                  disabled={!!busy}
                  onPress={() =>
                    void run(
                      agent.id,
                      () =>
                        request(`${COMMISSIONS.agents}/${agent.id}`, "POST", {
                          active: !agent.active,
                        }),
                      agent.active ? "Gestor desactivado." : "Gestor activado.",
                      "No se pudo cambiar el gestor.",
                    )
                  }
                  accessibilityRole="button"
                  style={styles.secondary}
                >
                  <Text style={styles.link}>{agent.active ? "Desactivar" : "Activar"}</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.block}>
              <Text style={styles.label}>Nuevo gestor (miembro de la tienda)</Text>
              {memberOptions.length ? (
                <PillGroup
                  accessibilityLabel="Miembro que será gestor"
                  value={newMemberId}
                  onChange={setNewMemberId}
                  options={memberOptions
                    .filter((person) => person.member?.id)
                    .map((person) => ({
                      value: person.member?.id ?? "",
                      label: person.member?.email ?? "Miembro",
                    }))}
                />
              ) : (
                <Text style={styles.muted}>
                  Invita primero a la persona desde Equipo y permisos.
                </Text>
              )}
              <TextInput
                value={newCode}
                onChangeText={(text) => setNewCode(text.toUpperCase())}
                autoCapitalize="characters"
                maxLength={12}
                accessibilityLabel="Código del gestor"
                placeholder="Código para ventas online (p. ej. ANA2026)"
                placeholderTextColor={theme.placeholderText}
                style={styles.input}
              />
              <Button
                title="Añadir gestor"
                disabled={!newMemberId || busy === "agent"}
                onPress={async () => {
                  if (
                    await run(
                      "agent",
                      () =>
                        request(COMMISSIONS.agents, "POST", {
                          member_id: newMemberId,
                          code: newCode,
                        }),
                      "Gestor de venta añadido.",
                      "No se pudo añadir el gestor.",
                    )
                  ) {
                    setNewMemberId("");
                    setNewCode("");
                  }
                }}
              />
            </View>
          </Section>

          <Section title="Reglas de comisión">
            <View style={styles.block}>
              <Text style={styles.label}>Porcentaje general de la tienda</Text>
              <Text style={styles.muted}>Se aplica a los productos sin comisión propia.</Text>
              <View style={styles.inline}>
                <TextInput
                  value={generalPercent}
                  onChangeText={setGeneralPercent}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  accessibilityLabel="Porcentaje general"
                  placeholder="Ej.: 5"
                  placeholderTextColor={theme.placeholderText}
                  style={[styles.input, styles.flex]}
                />
                <Text style={styles.rowTitle}>%</Text>
                <Pressable
                  disabled={busy === "general"}
                  onPress={() =>
                    void run(
                      "general",
                      () =>
                        request(COMMISSIONS.rules, "POST", {
                          kind: "percent",
                          value: Number(generalPercent.replace(",", ".")),
                        }),
                      "Porcentaje general guardado.",
                      "No se pudo guardar el porcentaje.",
                    )
                  }
                  accessibilityRole="button"
                  style={styles.secondary}
                >
                  <Text style={styles.link}>Guardar</Text>
                </Pressable>
              </View>
            </View>
            {productRules.map((rule) => (
              <View key={rule.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>
                    {productTitle.get(rule.product_id as string) ?? "Producto"}
                  </Text>
                  <Text style={styles.muted}>{ruleLabel(rule)}</Text>
                </View>
                <Pressable
                  disabled={!!busy}
                  onPress={() =>
                    void run(
                      rule.id,
                      () => request(`${COMMISSIONS.rules}/${rule.id}`, "DELETE"),
                      "Comisión del producto eliminada.",
                      "No se pudo eliminar la comisión.",
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar comisión del producto"
                  style={styles.secondary}
                >
                  <Text style={styles.danger}>Quitar</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.block}>
              <Text style={styles.label}>Comisión propia de un producto</Text>
              <TextInput
                value={productQuery}
                onChangeText={(text) => {
                  setProductQuery(text);
                  setRuleProductId("");
                }}
                accessibilityLabel="Buscar producto"
                placeholder="Busca el producto por nombre"
                placeholderTextColor={theme.placeholderText}
                style={styles.input}
              />
              {matchingProducts.length ? (
                <PillGroup
                  accessibilityLabel="Producto"
                  value={ruleProductId}
                  onChange={setRuleProductId}
                  options={matchingProducts.map((product) => ({
                    value: product.id,
                    label: product.title ?? "Producto",
                  }))}
                />
              ) : null}
              <PillGroup
                accessibilityLabel="Tipo de comisión"
                value={ruleKind}
                onChange={setRuleKind}
                options={[
                  { value: "fixed", label: "Importe por unidad" },
                  { value: "percent", label: "Porcentaje" },
                ]}
              />
              <TextInput
                value={ruleValue}
                onChangeText={setRuleValue}
                keyboardType="decimal-pad"
                inputMode="decimal"
                accessibilityLabel={ruleKind === "fixed" ? "Importe en USD" : "Porcentaje"}
                placeholder={ruleKind === "fixed" ? "Importe en USD" : "Porcentaje"}
                placeholderTextColor={theme.placeholderText}
                style={styles.input}
              />
              {ruleKind === "fixed" ? (
                <TextInput
                  value={ruleThreshold}
                  onChangeText={setRuleThreshold}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  accessibilityLabel="Umbral acumulable en unidades"
                  placeholder="Umbral acumulable (opcional): cada cuántas unidades"
                  placeholderTextColor={theme.placeholderText}
                  style={styles.input}
                />
              ) : null}
              <Button
                title="Guardar comisión del producto"
                disabled={!ruleProductId || busy === "rule"}
                onPress={async () => {
                  if (
                    await run(
                      "rule",
                      () =>
                        request(COMMISSIONS.rules, "POST", {
                          product_id: ruleProductId,
                          kind: ruleKind,
                          value: Number(ruleValue.replace(",", ".")),
                          unit_threshold:
                            ruleKind === "fixed" && ruleThreshold ? Number(ruleThreshold) : null,
                        }),
                      "Comisión del producto guardada.",
                      "No se pudo guardar la comisión.",
                    )
                  ) {
                    setProductQuery("");
                    setRuleProductId("");
                    setRuleValue("");
                    setRuleThreshold("");
                  }
                }}
              />
            </View>
          </Section>
        </>
      ) : null}
    </OperationList>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Figure({
  label,
  value,
  styles,
  strong,
}: {
  label: string;
  value: string;
  styles: Styles;
  strong?: boolean;
}) {
  return (
    <View style={styles.figure}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={strong ? styles.figureStrong : styles.rowTitle}>{value}</Text>
    </View>
  );
}

function SaleRow({ sale, styles }: { sale: AgentSale; styles: Styles }) {
  const commission = sale.lines.reduce((sum, line) => sum + Number(line.commission), 0);
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>
          {sale.lines
            .map((line) => `${line.quantity} × ${line.title ?? line.sku ?? "Producto"}`)
            .join(", ")}
        </Text>
        <Text style={styles.muted}>
          {shortDate(sale.created_at)} · {PAYMENT_LABEL[sale.payment_method]} · {money(sale.total)}
        </Text>
      </View>
      <Text style={styles.rowTitle}>+{money(commission)}</Text>
    </View>
  );
}

const WITHDRAWAL_TONE: Record<Withdrawal["status"], BadgeTone> = {
  requested: "warning",
  paid: "success",
  rejected: "error",
};

const createStyles = (theme: ReturnType<typeof useBusinessTheme>) =>
  StyleSheet.create({
    back: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
    link: { color: theme.action, fontSize: 14, fontWeight: "500" },
    danger: { color: theme.error, fontSize: 14, fontWeight: "500" },
    notice: { color: theme.successText, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    block: { padding: 14, gap: 8 },
    pad: { padding: 14 },
    flex: { flex: 1 },
    figures: { flexDirection: "row", gap: 12 },
    figure: { flex: 1, gap: 2 },
    figureStrong: { color: theme.text, fontSize: 20, fontWeight: "700" },
    label: { color: theme.text, fontSize: 13, fontWeight: "500", marginTop: 4 },
    muted: { color: theme.muted, fontSize: 12 },
    inline: { flexDirection: "row", alignItems: "center", gap: 8 },
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
    secondary: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
    disabled: { opacity: 0.45 },
    row: {
      minHeight: 60,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderBottomColor: theme.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowTitle: { color: theme.text, fontSize: 14, fontWeight: "500" },
    spaced: { marginTop: 12 },
    dayRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
    dayLabel: { width: 56 },
    dayValue: { width: 76, textAlign: "right" },
    barTrack: {
      flex: 1,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.background,
      overflow: "hidden",
    },
    bar: { height: 10, borderRadius: 5, backgroundColor: theme.action },
    rankRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
    rank: { width: 22, color: theme.muted, fontSize: 14, fontWeight: "700", textAlign: "center" },
  });
