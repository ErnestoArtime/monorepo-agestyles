type PermissionRight = "view" | "edit" | "manage";

type PermissionMember = {
  is_owner?: boolean;
  permissions?: Record<string, string | undefined>;
} | null;

const RIGHT_RANK: Record<PermissionRight, number> = {
  view: 1,
  edit: 2,
  manage: 3,
};

export function hasPermission(
  member: PermissionMember,
  resource: string,
  minimum: PermissionRight = "view",
): boolean {
  if (member?.is_owner) return true;
  const right = member?.permissions?.[resource] as PermissionRight | undefined;
  return Boolean(right && RIGHT_RANK[right] >= RIGHT_RANK[minimum]);
}
