import { Icon } from "@agestyles/icons";
import { BottomSheet, Button } from "@agestyles/ui-native";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Modal, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBusinessTheme } from "../hooks/use-business-theme";

export type TableColumn<T> = {
  id: string;
  label: string;
  width: string;
  render: (item: T) => ReactNode;
  sort?: { direction?: "ascending" | "descending"; toggle: () => void };
};

type TableProps<T> = {
  caption: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (item: T) => string;
  actionLabel: (item: T) => string;
  onOpen: (item: T) => void;
};

export function ManagementTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  actionLabel,
  onOpen,
}: TableProps<T>) {
  const theme = useBusinessTheme();
  return (
    <div className="ag-management-table" style={{ color: theme.text }}>
      <style>{`
        .ag-management-table table { border-collapse: collapse; width: 100%; table-layout: fixed; font: 14px system-ui, sans-serif; }
        .ag-management-table th, .ag-management-table td { padding: 10px 12px; text-align: start; overflow-wrap: anywhere; }
        .ag-management-table thead th { color: ${theme.muted}; font-size: 13px; font-weight: 600; background: ${theme.quietSurface}; }
        .ag-management-table tbody th, .ag-management-table td { border-block-start: 1px solid ${theme.border}; }
        .ag-management-table tbody tr { cursor: pointer; }
        .ag-management-table tbody tr:hover, .ag-management-table tbody tr:focus-within { background: ${theme.selectedSurface}; }
        .ag-management-table button { font: inherit; color: inherit; cursor: pointer; background: transparent; border: 0; padding: 0; min-height: 32px; text-align: start; }
        .ag-management-table thead button { display: inline-flex; gap: 5px; align-items: center; }
        .ag-management-table button:focus-visible { outline: 2px solid ${theme.action}; outline-offset: 3px; border-radius: 4px; }
        .ag-management-table .ag-row-action { min-width: 40px; text-align: center; }
        .ag-management-table .ag-cell-detail { display: block; margin-block-start: 4px; color: ${theme.muted}; font-size: 12px; font-weight: 400; }
        .ag-management-table caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      `}</style>
      <table>
        <caption>{caption}</caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
          <col style={{ width: "11%" }} />
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" aria-sort={column.sort?.direction}>
                {column.sort ? (
                  <button type="button" onClick={column.sort.toggle}>
                    {column.label}
                    {column.sort.direction ? (
                      <span aria-hidden="true">
                        <Icon
                          name={column.sort.direction === "ascending" ? "chevronUp" : "chevronDown"}
                          size={14}
                        />
                      </span>
                    ) : null}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr
              key={rowKey(item)}
              onClick={(event) => {
                if (window.getSelection()?.toString()) return;
                event.currentTarget.querySelector("button")?.focus();
                onOpen(item);
              }}
            >
              {columns.map((column, index) =>
                index === 0 ? (
                  <th key={column.id} scope="row">
                    {column.render(item)}
                  </th>
                ) : (
                  <td key={column.id}>{column.render(item)}</td>
                ),
              )}
              <td>
                <button
                  className="ag-row-action"
                  type="button"
                  aria-label={actionLabel(item)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(item);
                  }}
                >
                  <Icon name="more" size={18} color={theme.text} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResponsiveManagementList<T>({
  renderCompact,
  ...table
}: TableProps<T> & { renderCompact: () => ReactNode }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={{ minWidth: 0 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {Platform.OS === "web" && width >= 750 ? <ManagementTable {...table} /> : renderCompact()}
    </View>
  );
}

export function ManagementPager({
  count,
  offset,
  limit,
  loading,
  onChange,
}: {
  count: number;
  offset: number;
  limit: number;
  loading: boolean;
  onChange: (offset: number) => void;
}) {
  const theme = useBusinessTheme();
  if (count <= limit && !offset) return null;
  return (
    <View
      style={{
        padding: 12,
        gap: 10,
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text accessibilityLiveRegion="polite" style={{ color: theme.muted }}>
        {offset < count
          ? `${offset + 1}–${Math.min(offset + limit, count)} de ${count}`
          : `${count} resultados`}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          title="Anterior"
          variant="secondary"
          disabled={loading || offset === 0}
          onPress={() => onChange(Math.max(0, offset - limit))}
        />
        <Button
          title="Siguiente"
          variant="secondary"
          disabled={loading || offset + limit >= count}
          onPress={() => onChange(offset + limit)}
        />
      </View>
    </View>
  );
}

export function ManagementPanel({
  title,
  wide,
  fullScreen = false,
  onClose,
  children,
}: {
  title: string;
  wide: boolean;
  fullScreen?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const theme = useBusinessTheme();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  if (Platform.OS !== "web" && fullScreen) {
    return (
      <Modal visible onRequestClose={onClose} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              gap: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ color: theme.text, fontWeight: "700", fontSize: 22, flex: 1 }}
            >
              {title}
            </Text>
            <Button title="Cerrar" variant="secondary" onPress={onClose} />
          </View>
          <ScrollView>{children}</ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  if (Platform.OS !== "web") {
    return (
      <BottomSheet visible onClose={onClose} title={title}>
        {children}
      </BottomSheet>
    );
  }

  return (
    <dialog
      ref={dialog}
      className="ag-management-panel"
      data-wide={wide}
      data-fullscreen={fullScreen}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <style>{`
        .ag-management-panel { box-sizing: border-box; border: 1px solid ${theme.border}; background: ${theme.surface}; color: ${theme.text}; font: 15px system-ui, sans-serif; padding: 0; overflow: auto; overscroll-behavior: contain; max-width: 100%; }
        .ag-management-panel[data-wide=true] { position: fixed; inset: 0 0 0 auto; margin: 0; width: min(520px, 100%); height: 100dvh; max-height: 100dvh; }
        .ag-management-panel[data-wide=false] { position: fixed; inset: auto 0 0; margin: 0 auto; width: min(640px, 100%); max-height: 90dvh; border-radius: 16px 16px 0 0; }
        .ag-management-panel[data-wide=false][data-fullscreen=true] { width: 100%; height: 100dvh; max-height: 100dvh; border-radius: 0; }
        .ag-management-panel::backdrop { background: rgba(0,0,0,.46); overflow: hidden; overscroll-behavior: contain; }
        .ag-management-panel header { position: sticky; top: 0; z-index: 2; background: ${theme.surface}; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; border-bottom: 1px solid ${theme.border}; }
        .ag-management-panel h1 { font-size: 21px; margin: 0; overflow-wrap: anywhere; }
        .ag-management-panel button.ag-dialog-close { cursor: pointer; color: inherit; font: inherit; display: grid; place-items: center; padding: 0; width: 44px; height: 44px; flex: 0 0 44px; background: transparent; border: 0; }
        .ag-management-panel button.ag-dialog-close:focus-visible { outline: 2px solid ${theme.action}; outline-offset: 3px; border-radius: 4px; }
        .ag-management-panel button.ag-dialog-close:hover { background: ${theme.quietSurface}; border-radius: 8px; }
      `}</style>
      <header>
        <h1 id={titleId}>{title}</h1>
        <button
          type="button"
          className="ag-dialog-close"
          aria-label="Cerrar panel"
          onClick={() => dialog.current?.close()}
        >
          <Icon name="close" color={theme.text} size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
