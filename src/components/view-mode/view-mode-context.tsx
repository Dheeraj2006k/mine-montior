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

// Team-leader spec: trend enum -> plain-language + arrow. Technical view
// keeps the raw enum word (still meaningful to an engineer); Plain view
// gets the arrow + human phrase. Centralised so /dashboard, /predictions,
// and /twin render the same words for the same trend value.
export const TREND_COPY: Record<string, { arrow: string; plain: string; technical: string; color: string }> = {
  accelerating: { arrow: "↑", plain: "Getting Worse", technical: "Accelerating", color: "var(--offline)" },
  stable: { arrow: "→", plain: "Steady", technical: "Stable", color: "var(--muted)" },
  decelerating: { arrow: "↓", plain: "Improving", technical: "Decelerating", color: "var(--normal)" },
};

export function useTrendCopy(trend: string | undefined | null) {
  const { mode } = useViewMode();
  const entry = trend ? TREND_COPY[trend] : undefined;
  if (!entry) return { arrow: "-", text: trend ?? "-", color: "var(--foreground)" };
  return { arrow: entry.arrow, text: mode === "plain" ? entry.plain : entry.technical, color: entry.color };
}

// Cluster-event escalation reason, translated for Plain view. Deliberately
// NOT an "N of M sensors agree" count - no such discrete cross-sensor
// count exists in the schema today (cluster_events.triggering_node_id is a
// single node; alerts.event_count tracks repeated escalations over time,
// not distinct corroborating sensors). Inventing N/M here would violate
// the "do not invent evidence" rule, so this stays qualitative until the
// alert engine actually tracks per-alert corroborating-node counts.
export const REASON_COPY: Record<string, { plain: string; technical: string }> = {
  strong_single_signal: { plain: "One sensor showing a strong signal", technical: "strong_single_signal" },
  combined_evidence: { plain: "Multiple signals agreeing", technical: "combined_evidence" },
  sensor_health_unknown: { plain: "Sensor health uncertain", technical: "sensor_health_unknown" },
};

export function useReasonCopy(reason: string | undefined | null): string {
  const { mode } = useViewMode();
  if (!reason) return "-";
  const entry = REASON_COPY[reason];
  if (!entry) return reason;
  return mode === "plain" ? entry.plain : entry.technical;
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
