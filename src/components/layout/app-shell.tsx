"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { IrisIconMark, IrisWordmark } from "@/components/layout/iris-logo";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import {
  DashboardIcon,
  NodesIcon,
  AlertIcon,
  TwinIcon,
  BlastIcon,
  ContactsIcon,
  BellIcon,
  PulseIcon,
  GearIcon,
  TrendIcon,
  SatelliteIcon,
  DatabaseIcon,
} from "@/components/layout/nav-icons";

export type AppRole = "viewer" | "operator" | "admin";
type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; minRole: AppRole };

// Grouped per the site's information architecture: primary monitoring is
// what most sessions live in day to day; analysis is deeper model/satellite
// context; system/admin are operational and access-control tooling. Each
// item's minRole mirrors the actual API-level RBAC gate it depends on
// (src/lib/auth/roles.ts) - this is presentation filtering only, the real
// enforcement stays server-side, so hiding a link here is a UX courtesy,
// never the security boundary itself.
const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, minRole: "viewer" },
      { href: "/nodes", label: "Nodes", icon: NodesIcon, minRole: "viewer" },
      { href: "/alerts", label: "Alerts", icon: AlertIcon, minRole: "viewer" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/predictions", label: "Predictions", icon: TrendIcon, minRole: "viewer" },
      { href: "/insar", label: "InSAR", icon: SatelliteIcon, minRole: "viewer" },
      { href: "/twin", label: "Digital Twin", icon: TwinIcon, minRole: "viewer" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/system", label: "System health", icon: PulseIcon, minRole: "viewer" },
      { href: "/system/data", label: "Data Monitor", icon: DatabaseIcon, minRole: "viewer" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/setup", label: "Site setup", icon: GearIcon, minRole: "admin" },
      { href: "/admin/blasts", label: "Blast schedule", icon: BlastIcon, minRole: "operator" },
      { href: "/admin/contacts", label: "Contacts", icon: ContactsIcon, minRole: "admin" },
      { href: "/admin/notifications", label: "Notification log", icon: BellIcon, minRole: "admin" },
      { href: "/admin/users", label: "Users & roles", icon: GearIcon, minRole: "admin" },
    ],
  },
];

const ROLE_RANK: Record<AppRole, number> = { viewer: 0, operator: 1, admin: 2 };

export function visibleFor(role: AppRole | null, item: Pick<NavItem, "minRole">): boolean {
  // While the role hasn't loaded yet, show everything rather than flash a
  // truncated menu - the API itself still enforces the real boundary.
  if (!role) return true;
  return ROLE_RANK[role] >= ROLE_RANK[item.minRole];
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
      aria-current={active ? "page" : undefined}
      style={{
        color: active ? "var(--foreground)" : "var(--muted)",
        background: active ? "var(--surface-2)" : "transparent",
        fontWeight: active ? 500 : 400,
      }}
    >
      <Icon />
      {label}
    </Link>
  );
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex flex-col gap-0.5 min-w-0">
      <IrisWordmark width={compact ? 88 : 100} priority className="iris-brand-wordmark" />
      <span className="iris-brand-subtitle">Intelligent Real-time Instability Sensing</span>
    </span>
  );
}

function useSession() {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setRole(body?.data?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  return { email, role };
}

function AccountFooter({ email, role }: { email: string | null; role: AppRole | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Purge every cached query result - the QueryClient is created once at
    // the root layout and survives client-side navigation, so without this
    // the next person to sign in on this tab could briefly see the
    // previous user's cached rows before fresh queries land.
    queryClient.clear();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="px-2">
      <div
        className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="text-xs truncate" style={{ color: "var(--muted)" }} title={email ?? undefined}>
            {email ?? "..."}
          </span>
          {role && (
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>
              {role}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={signingOut}
          className="text-xs shrink-0 font-medium hover:underline disabled:opacity-50"
          style={{ color: "var(--faint)" }}
          aria-label="Logout"
        >
          {signingOut ? "..." : "Logout"}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { email, role } = useSession();

  const allItems = NAV_GROUPS.flatMap((g) => g.items);

  return (
    <div className="min-h-screen flex">
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r px-3 py-4 gap-6"
        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      >
        <div className="flex items-center justify-between gap-2 px-2">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <IrisIconMark size={30} priority className="iris-brand-eye" />
            <BrandLockup />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {NAV_GROUPS.map((group, i) => {
            const items = group.items.filter((item) => visibleFor(role, item));
            if (items.length === 0) return null;
            return (
              <div key={group.label ?? `group-${i}`} className="flex flex-col gap-0.5">
                {group.label && (
                  <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                    {group.label}
                  </div>
                )}
                {items.map((item) => (
                  <NavLink key={item.href} {...item} active={pathname === item.href} />
                ))}
              </div>
            );
          })}
        </div>

        <div className="mt-auto">
          <AccountFooter email={email} role={role} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="md:hidden border-b px-4 py-3 flex flex-col gap-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
              <IrisIconMark size={26} priority className="iris-brand-eye" />
              <BrandLockup compact />
            </Link>
            <ThemeToggle />
          </div>
          <nav className="flex gap-1 overflow-x-auto -mx-1 px-1">
            {allItems
              .filter((item) => visibleFor(role, item))
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap"
                  style={{
                    color: pathname === item.href ? "var(--foreground)" : "var(--muted)",
                    background: pathname === item.href ? "var(--surface-2)" : "transparent",
                    border: "1px solid var(--border)",
                  }}
                >
                  {item.label}
                </Link>
              ))}
          </nav>
        </header>
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
