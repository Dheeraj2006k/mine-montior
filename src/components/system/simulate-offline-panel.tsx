"use client";

import { useEffect, useState } from "react";

// PRD-2 §6: offline/cellular fallback prototype. Entirely client-side and
// clearly labeled SIMULATION throughout - no real edge hardware, cellular
// modem, or siren mesh exists in this build, and this component never
// claims otherwise. Gated off (disabled) whenever a real voice provider is
// actually configured, so it can't be mistaken for production behavior.
const STEPS = [
  "Local edge decision: no cellular uplink detected",
  "Simulated DTMF call sequence dialing priority-1 contact",
  "Simulated siren-mesh activation broadcast",
] as const;

type NodeSummary = { node_id: number; label: string };

export function SimulateOfflinePanel({ disabled, nodes }: { disabled: boolean; nodes: NodeSummary[] }) {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [acked, setAcked] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!running || step >= STEPS.length) return;
    const id = setTimeout(() => setStep((s) => s + 1), 900);
    return () => clearTimeout(id);
  }, [running, step]);

  function start() {
    setStep(0);
    setAcked({});
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setStep(0);
    setAcked({});
  }

  function ackNode(nodeId: number) {
    setAcked((prev) => ({ ...prev, [nodeId]: new Date().toLocaleTimeString() }));
  }

  const sirenActive = running && step >= STEPS.length;

  return (
    <section className="panel p-4 md:p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold">Offline / cellular fallback</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--faint)" }}>
            Prototype walkthrough only - no real edge device, modem, or siren hardware is involved.
          </p>
        </div>
        <span className="label-caveat">SIMULATION</span>
      </div>

      {disabled ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          A real voice provider is configured for this environment - the offline simulation is
          disabled here to avoid it ever being mistaken for production behavior.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary text-xs" onClick={start} disabled={running && step < STEPS.length}>
              {running ? "Running..." : "Simulate offline event"}
            </button>
            {(running || step > 0) && (
              <button className="btn btn-ghost text-xs" onClick={reset}>
                Reset
              </button>
            )}
          </div>

          {running && (
            <ol className="flex flex-col gap-2">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="status-dot"
                    style={{
                      color: i < step ? "var(--normal)" : i === step ? "var(--warning)" : "var(--faint)",
                      background: i < step ? "var(--normal)" : i === step ? "var(--warning)" : "var(--faint)",
                    }}
                  />
                  <span style={{ color: i <= step ? "var(--foreground)" : "var(--faint)" }}>{label}</span>
                  {i < step && <span className="text-xs" style={{ color: "var(--faint)" }}>done</span>}
                </li>
              ))}
            </ol>
          )}

          {sirenActive && (
            <div className="panel-2 rounded-lg p-3 flex flex-col gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--warning)" }}>
                Per-node acknowledgement (simulated)
              </div>
              {nodes.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--faint)" }}>No nodes to acknowledge.</p>
              ) : (
                nodes.map((n) => (
                  <div key={n.node_id} className="flex items-center justify-between text-sm">
                    <span>{n.label}</span>
                    {acked[n.node_id] ? (
                      <span className="text-xs" style={{ color: "var(--normal)" }}>acknowledged {acked[n.node_id]}</span>
                    ) : (
                      <button className="btn btn-ghost text-xs" onClick={() => ackNode(n.node_id)}>
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
