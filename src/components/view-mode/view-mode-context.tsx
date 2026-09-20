"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ViewMode = "plain" | "technical";

const ViewModeContext = createContext<{
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
}>({ mode: "plain", setMode: () => {} });

const STORAGE_KEY = "iris-view-mode";

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("plain");

  // Deliberately not a lazy useState initializer: this component is
  // server-rendered first (it's "use client", not ssr:false), so the
  // initial render must match the server's output ("plain") or React logs
  // a hydration mismatch whenever a user has "technical" saved. Reading
  // localStorage after mount and re-rendering is the standard, correct
  // fix for that - the resulting one-frame flash is preferable to a
  // hydration warning on every page load.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "plain" || saved === "technical") setModeState(saved);
  }, []);

  function setMode(m: ViewMode) {
    setModeState(m);
    window.localStorage.setItem(STORAGE_KEY, m);
  }

  return <ViewModeContext.Provider value={{ mode, setMode }}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  return useContext(ViewModeContext);
}

// PRD §3 translation table: Fuzzy Risk Index -> "Ground Stability Score", etc.
// Centralised here so every page renders the same term for the same field.
export const TERM: Record<string, { plain: string; technical: string }> = {
  fuzzyRiskIndex: { plain: "Ground Stability Score", technical: "Fuzzy Risk Index" },
  evidenceScore: { plain: "Confirmation Level", technical: "Evidence Score" },
  timeToThreshold: { plain: "Estimated Action Window", technical: "Time to Threshold" },
  predictedZone: { plain: "Areas to Watch", technical: "Predicted Zone Severity" },
  trend: { plain: "Direction", technical: "Trend" },
  modelVersion: { plain: "Model", technical: "Model Version" },
};

export function useTerm(key: keyof typeof TERM): string {
  const { mode } = useViewMode();
  return TERM[key][mode];
}

export function ViewModeToggle() {
  const { mode, setMode } = useViewMode();
  return (
    <div
      className="inline-flex items-center rounded-full p-0.5 text-xs font-medium"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      role="tablist"
      aria-label="Display mode"
    >
      {(["plain", "technical"] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => setMode(m)}
          className="px-2.5 py-1 rounded-full capitalize transition-colors"
          style={{
            color: mode === m ? "#021016" : "var(--muted)",
            background: mode === m ? "linear-gradient(135deg, var(--green), var(--accent))" : "transparent",
            fontWeight: mode === m ? 600 : 500,
          }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
