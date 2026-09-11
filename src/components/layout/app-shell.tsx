import Link from "next/link";
import { IrisLogo } from "@/components/layout/iris-logo";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/nodes", label: "Nodes" },
  { href: "/alerts", label: "Alerts" },
  { href: "/twin", label: "Digital Twin" },
  { href: "/admin/blasts", label: "Blast schedule" },
  { href: "/admin/contacts", label: "Contacts" },
  { href: "/admin/notifications", label: "Notification log" },
  { href: "/system", label: "System health" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight flex items-center gap-2">
            <IrisLogo />
            <span>
              IRIS{" "}
              <span className="font-normal hidden sm:inline" style={{ color: "var(--muted)" }}>
                · Intelligent RealTime Instability Sensing
              </span>
            </span>
          </Link>
          <nav className="flex gap-4 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-muted hover:text-foreground" style={{ color: "var(--muted)" }}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
