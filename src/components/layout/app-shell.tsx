"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IrisIconMark, IrisWordmark } from "@/components/layout/iris-logo";
import {
  DashboardIcon,
  NodesIcon,
  AlertIcon,
  TwinIcon,
  BlastIcon,
  ContactsIcon,
  BellIcon,
  PulseIcon,
} from "@/components/layout/nav-icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/nodes", label: "Nodes", icon: NodesIcon },
  { href: "/alerts", label: "Alerts", icon: AlertIcon },
  { href: "/twin", label: "Digital Twin", icon: TwinIcon },
];

const ADMIN_NAV = [
  { href: "/admin/blasts", label: "Blast schedule", icon: BlastIcon },
  { href: "/admin/contacts", label: "Contacts", icon: ContactsIcon },
  { href: "/admin/notifications", label: "Notification log", icon: BellIcon },
  { href: "/system", label: "System health", icon: PulseIcon },
];

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

function AccountFooter() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="px-2">
      <div
        className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <span className="text-xs truncate" style={{ color: "var(--muted)" }} title={email ?? undefined}>
          {email ?? "..."}
        </span>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-xs shrink-0 font-medium hover:underline disabled:opacity-50"
          style={{ color: "var(--faint)" }}
        >
          {signingOut ? "..." : "Sign out"}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r px-3 py-4 gap-6"
        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
          <IrisIconMark size={30} priority className="iris-brand-eye" />
          <BrandLockup />
        </Link>

        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </nav>

        <div className="flex flex-col gap-0.5">
          <div
            className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--faint)" }}
          >
            Admin
          </div>
          {ADMIN_NAV.map((item) => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </div>

        <div className="mt-auto">
          <AccountFooter />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="md:hidden border-b px-4 py-3 flex flex-col gap-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
        >
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <IrisIconMark size={26} priority className="iris-brand-eye" />
              <BrandLockup compact />
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mx-1 px-1">
            {[...NAV, ...ADMIN_NAV].map((item) => (
              <Link
                key={item.href}
                href={item.href}
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
