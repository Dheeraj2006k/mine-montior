import { AppShell } from "@/components/layout/app-shell";
import { ViewModeProvider } from "@/components/view-mode/view-mode-context";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewModeProvider>
      <AppShell>{children}</AppShell>
    </ViewModeProvider>
  );
}
