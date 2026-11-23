import { Icon } from "@agestyles/icons";
import { BottomSheet, StatusBadge } from "@agestyles/ui-native";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Platform } from "react-native";
import { useBusinessTheme } from "../hooks/use-business-theme";

export type UserSort = { key: "name" | "date"; direction: "ascending" | "descending" };

type UserDirectoryRow = {
  email: string;
  name: string;
  access: string;
  stores: string;
  active: boolean;
  date: string | null;
  edit: () => void;
};

export function UserDirectoryTable({
  users,
  sort,
  onSort,
}: {
  users: UserDirectoryRow[];
  sort: UserSort;
  onSort: (key: UserSort["key"]) => void;
}) {
  const theme = useBusinessTheme();
  function sortHeader(key: UserSort["key"], label: string) {
    return (
      <th scope="col" aria-sort={sort.key === key ? sort.direction : undefined}>
        <button type="button" onClick={() => onSort(key)}>
          {label}
          {sort.key === key ? (
            <span aria-hidden="true">
              <Icon name={sort.direction === "ascending" ? "chevronUp" : "chevronDown"} size={14} />
            </span>
          ) : null}
        </button>
      </th>
    );
  }

  return (
    <div className="ag-user-table" style={{ color: theme.text }}>
      <style>{`
        .ag-user-table table { border-collapse: collapse; width: 100%; table-layout: fixed; font: 14px system-ui, sans-serif; }
        .ag-user-table th, .ag-user-table td { padding: 10px 12px; text-align: start; overflow-wrap: anywhere; }
        .ag-user-table thead th { color: ${theme.muted}; font-size: 13px; font-weight: 600; background: ${theme.quietSurface}; }
        .ag-user-table tbody th, .ag-user-table td { border-block-start: 1px solid ${theme.border}; }
        .ag-user-table tbody tr { cursor: pointer; }
        .ag-user-table tbody tr:hover, .ag-user-table tbody tr:focus-within { background: ${theme.selectedSurface}; }
        .ag-user-table button, .ag-user-dialog button.ag-dialog-close { font: inherit; color: inherit; cursor: pointer; }
        .ag-user-table button { background: transparent; border: 0; padding: 0; min-height: 32px; text-align: start; }
        .ag-user-table thead button { display: inline-flex; gap: 5px; align-items: center; }
        .ag-user-table button:focus-visible, .ag-user-dialog button.ag-dialog-close:focus-visible { outline: 2px solid ${theme.action}; outline-offset: 3px; border-radius: 4px; }
        .ag-user-table .ag-user-action { min-width: 40px; text-align: center; }
        .ag-user-table .ag-user-email { display: block; margin-block-start: 4px; color: ${theme.muted}; font-size: 12px; font-weight: 400; }
        .ag-user-table caption { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      `}</style>
      <table>
        <caption>Usuarios del marketplace</caption>
        <colgroup>
          <col style={{ width: "29%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            {sortHeader("name", "Usuario")}
            <th scope="col">Acceso</th>
            <th scope="col">Tiendas</th>
            <th scope="col">Estado</th>
            {sortHeader("date", "Alta")}
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.email}
              onClick={(event) => {
                if (window.getSelection()?.toString()) return;
                event.currentTarget.querySelector("button")?.focus();
                user.edit();
              }}
            >
              <th scope="row">
                {user.name}
                {user.name !== user.email ? (
                  <span className="ag-user-email">{user.email}</span>
                ) : null}
              </th>
              <td>{user.access}</td>
              <td>{user.stores}</td>
              <td>
                <div style={{ display: "inline-flex" }}>
                  <StatusBadge
                    label={user.active ? "Activo" : "Sin activar"}
                    tone={user.active ? "success" : "warning"}
                  />
                </div>
              </td>
              <td>{user.date ?? "—"}</td>
              <td>
                <button
                  className="ag-user-action"
                  type="button"
                  aria-label={`Ver permisos de ${user.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    user.edit();
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

export function UserDirectoryPanel({
  title,
  wide,
  onClose,
  children,
}: {
  title: string;
  wide: boolean;
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
      className="ag-user-dialog"
      data-wide={wide}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      <style>{`
        .ag-user-dialog { box-sizing: border-box; border: 1px solid ${theme.border}; background: ${theme.surface}; color: ${theme.text}; font: 15px system-ui, sans-serif; padding: 0; overflow: auto; overscroll-behavior: contain; max-width: 100%; }
        .ag-user-dialog[data-wide=true] { position: fixed; inset: 0 0 0 auto; margin: 0; width: min(520px, 100%); height: 100dvh; max-height: 100dvh; }
        .ag-user-dialog[data-wide=false] { position: fixed; inset: auto 0 0; margin: 0 auto; width: min(640px, 100%); max-height: 90dvh; border-radius: 16px 16px 0 0; }
        .ag-user-dialog::backdrop { background: rgba(0,0,0,.46); overflow: hidden; overscroll-behavior: contain; }
        .ag-user-dialog header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; border-bottom: 1px solid ${theme.border}; }
        .ag-user-dialog h1 { font-size: 21px; margin: 0; overflow-wrap: anywhere; }
        .ag-user-dialog button.ag-dialog-close { display: grid; place-items: center; padding: 0; width: 44px; height: 44px; flex: 0 0 44px; background: transparent; border: 0; }
        .ag-user-dialog button.ag-dialog-close:hover { background: ${theme.quietSurface}; border-radius: 8px; }
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
