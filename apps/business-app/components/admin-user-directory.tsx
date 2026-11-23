import { StatusBadge } from "@agestyles/ui-native";
import { ManagementTable, type TableColumn } from "./management-list";

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
  const sortColumn = (key: UserSort["key"]) => ({
    direction: sort.key === key ? sort.direction : undefined,
    toggle: () => onSort(key),
  });
  const columns: TableColumn<UserDirectoryRow>[] = [
    {
      id: "name",
      label: "Usuario",
      width: "28%",
      sort: sortColumn("name"),
      render: (user) => (
        <>
          {user.name}
          {user.name !== user.email ? <span className="ag-cell-detail">{user.email}</span> : null}
        </>
      ),
    },
    { id: "access", label: "Acceso", width: "18%", render: (user) => user.access },
    { id: "stores", label: "Tiendas", width: "14%", render: (user) => user.stores },
    {
      id: "status",
      label: "Estado",
      width: "15%",
      render: (user) => (
        <div style={{ display: "inline-flex" }}>
          <StatusBadge
            label={user.active ? "Activo" : "Sin activar"}
            tone={user.active ? "success" : "warning"}
          />
        </div>
      ),
    },
    {
      id: "date",
      label: "Alta",
      width: "14%",
      sort: sortColumn("date"),
      render: (user) => user.date ?? "—",
    },
  ];
  return (
    <ManagementTable
      caption="Usuarios del marketplace"
      rows={users}
      columns={columns}
      rowKey={(user) => user.email}
      actionLabel={(user) => `Ver permisos de ${user.name}`}
      onOpen={(user) => user.edit()}
    />
  );
}
