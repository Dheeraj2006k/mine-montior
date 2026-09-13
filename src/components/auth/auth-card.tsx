import Link from "next/link";
import { IrisLogo } from "@/components/layout/iris-logo";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm flex flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2">
          <IrisLogo size={30} />
          <span className="font-semibold tracking-tight">IRIS</span>
        </Link>

        <div className="panel p-6 md:p-7">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-muted mt-1" style={{ color: "var(--muted)" }}>
              {subtitle}
            </p>
          </div>
          {children}
        </div>

        <p className="text-center text-sm text-muted" style={{ color: "var(--muted)" }}>
          {footer}
        </p>
      </div>
    </div>
  );
}
