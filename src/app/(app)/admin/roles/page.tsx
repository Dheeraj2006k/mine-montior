import { requireRolePage } from "@/lib/auth/roles";

const ROLES = [
  {
    name: "Viewer",
    tagline: "Default role for every newly registered account.",
    capabilities: [
      "Main dashboard, site status, map",
      "Nodes, sensor readings, node health",
      "Alerts (read-only)",
      "InSAR evidence/analysis",
      "Digital twin / planning visualization",
      "Charts and history",
    ],
    restrictions: [
      "Cannot acknowledge, resolve, or dismiss alerts",
      "Cannot register or modify nodes",
      "Cannot modify site configuration",
      "Cannot manage users, roles, or ownership",
    ],
  },
  {
    name: "Operator",
    tagline: "Everything Viewer has, plus active-monitoring operations.",
    capabilities: [
      "All Viewer read access",
      "Acknowledge, investigate, and resolve/dismiss alerts",
      "Register nodes (operational sensor/node inspection)",
    ],
    restrictions: [
      "Cannot create or promote admin users",
      "Cannot change any user's role",
      "Cannot transfer site ownership",
      "Cannot change security/authentication or system-wide settings",
    ],
  },
  {
    name: "Admin",
    tagline: "Full control, including the Admin Control Center.",
    capabilities: [
      "All Operator capabilities",
      "View, search, and filter all registered users",
      "Activate/deactivate users, assign roles, reset a role to Viewer",
      "Manage site ownership and user-site assignment",
      "View the audit log of every administrative action",
      "Manage system-level settings the application already supports",
    ],
    restrictions: ["Cannot perform unsafe database operations directly from the browser - all mutations go through protected server-side APIs"],
  },
];

export default async function AdminRolesPage() {
  await requireRolePage("admin");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold">Role &amp; access</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          What each role can and cannot do. Enforced server-side on every API route (
          <code>src/lib/auth/roles.ts</code>, <code>src/lib/auth/permissions.ts</code>) - this page is documentation, not a
          settings toggle.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLES.map((r) => (
          <section key={r.name} className="panel p-4 md:p-5 flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">{r.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {r.tagline}
              </p>
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--faint)" }}>
                Can
              </h3>
              <ul className="flex flex-col gap-1 text-xs">
                {r.capabilities.map((c) => (
                  <li key={c} style={{ color: "var(--foreground)" }}>
                    + {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--faint)" }}>
                Cannot
              </h3>
              <ul className="flex flex-col gap-1 text-xs">
                {r.restrictions.map((c) => (
                  <li key={c} style={{ color: "var(--muted)" }}>
                    - {c}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
