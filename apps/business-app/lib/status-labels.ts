const orderStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completado",
  archived: "Archivado",
  canceled: "Cancelado",
  requires_action: "Requiere atención",
};

const productStatusLabels: Record<string, string> = {
  draft: "Borrador",
  proposed: "Pendiente de revisión",
  published: "Publicado",
  rejected: "Rechazado",
};

export function orderStatusLabel(status?: string) {
  if (!status) return "Pendiente";
  return orderStatusLabels[status.toLowerCase()] ?? "En curso";
}

export function productStatusLabel(status?: string) {
  if (!status) return "Sin estado";
  return productStatusLabels[status.toLowerCase()] ?? "Estado del producto";
}
