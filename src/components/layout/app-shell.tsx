"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IrisLogo } from "@/components/layout/iris-logo";
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
  { href: "/", label: "Dashboard", icon: DashboardIcon },
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 border-r px-3 py-4 gap-6"
        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      >
        <Link href="/" className="flex items-center gap-2 px-2">
          <IrisLogo size={26} />
          <div className="leading-tight">
            <div className="font-semibold text-sm tracking-tight">IRIS</div>
            <div className="text-[10px] text-muted" style={{ color: "var(--faint)" }}>
              Instability Sensing
            </div>
          </div>
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

      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="md:hidden border-b px-4 py-3 flex flex-col gap-3"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
        >
          <div className="flex items-center gap-2">
            <IrisLogo size={22} />
            <span className="font-semibold text-sm">IRIS</span>
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
