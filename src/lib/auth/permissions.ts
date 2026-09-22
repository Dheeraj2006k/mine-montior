// Role/permission model - deliberately kept free of any server-only import
// (next/headers, supabase server clients) so client components can import
// AppRole/hasRole/hasPermission directly (see src/lib/auth/use-current-user.ts)
// without pulling server-only code into the browser bundle. src/lib/auth/roles.ts
// re-exports the role types/helpers from here for route-handler/server-component use.
export type AppRole = "viewer" | "operator" | "admin";
export type ProfileStatus = "active" | "inactive";

const RANK: Record<AppRole, number> = { viewer: 0, operator: 1, admin: 2 };

export function roleAtLeast(role: AppRole, min: AppRole): boolean {
  return RANK[role] >= RANK[min];
}

// Thin, readable wrapper for call sites that just want a boolean (e.g. UI
// conditionals that already have a resolved role in hand).
export function hasRole(role: AppRole | null, min: AppRole): boolean {
  if (!role) return false;
  return roleAtLeast(role, min);
}

// PRD-2 §21 permission matrix. This is the single source of truth for what
// each role can do - pages, layouts, API routes, and server actions all
// call hasPermission()/requirePermission() against this table instead of
// scattering role-name string comparisons through the app.
export type Permission =
  // viewer - read-only monitoring
  | "dashboard.view"
  | "map.view"
  | "alerts.view"
  | "insar.view"
  | "twin.view"
  | "readings.view"
  // operator - adds operational actions on top of viewer
  | "alerts.acknowledge"
  | "alerts.investigate"
  | "alerts.note"
  | "nodes.operational_action"
  // admin - adds user/site/system administration on top of operator
  | "users.view"
  | "users.manage"
  | "roles.manage"
  | "ownership.manage"
  | "sites.manage"
  | "settings.manage"
  | "audit.view";

const VIEWER_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "map.view",
  "alerts.view",
  "insar.view",
  "twin.view",
  "readings.view",
];

const OPERATOR_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  "alerts.acknowledge",
  "alerts.investigate",
  "alerts.note",
  "nodes.operational_action",
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...OPERATOR_PERMISSIONS,
  "users.view",
  "users.manage",
  "roles.manage",
  "ownership.manage",
  "sites.manage",
  "settings.manage",
  "audit.view",
];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  viewer: VIEWER_PERMISSIONS,
  operator: OPERATOR_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
};

export function hasPermission(role: AppRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
