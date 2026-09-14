"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

type Blast = {
  id: number;
  panel_label: string | null;
  planned_start: string;
  planned_end: string;
  note: string | null;
};

export default function BlastsAdminPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["blasts"],
    queryFn: () => apiGet<Blast[]>("/api/blasts"),
  });
  const blasts = query.data?.data ?? [];

  const [panelLabel, setPanelLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/blasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panel_label: panelLabel || null,
          planned_start: start ? new Date(start).toISOString() : null,
          planned_end: end ? new Date(end).toISOString() : null,
          note: note || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blasts"] });
      setPanelLabel("");
      setStart("");
      setEnd("");
      setNote("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/blasts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blasts"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Blast schedule</h1>
        <p className="text-sm text-muted mt-1" style={{ color: "var(--muted)" }}>
          Overlapping a scheduled blast never lowers the severity shown on the dashboard - it
          only downgrades notification urgency (PRD §7.3).
        </p>
      </div>

      <form
        className="panel p-4 md:p-5 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <input
          className="input"
          placeholder="Panel label (e.g. Panel A3)"
          value={panelLabel}
          onChange={(e) => setPanelLabel(e.target.value)}
        />
        <input
          className="input"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <label className="text-sm flex flex-col gap-1.5">
          <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>Planned start</span>
          <input
            type="datetime-local"
            className="input"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </label>
        <label className="text-sm flex flex-col gap-1.5">
          <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>Planned end</span>
          <input
            type="datetime-local"
            className="input"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn-primary sm:col-span-2" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Adding..." : "Add blast window"}
        </button>
        {createMutation.isError && (
          <p className="text-sm sm:col-span-2" style={{ color: "var(--offline)" }}>
            {(createMutation.error as Error).message}
          </p>
        )}
      </form>

      <div className="panel overflow-hidden">
        {blasts.map((b) => (
          <div
            key={b.id}
            className="panel-row px-4 md:px-5 py-3.5 flex items-center justify-between border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <div className="text-sm font-medium">{b.panel_label ?? "(unlabelled panel)"}</div>
              <div className="text-xs text-muted mt-0.5" style={{ color: "var(--muted)" }}>
                {new Date(b.planned_start).toLocaleString()} {"->"} {new Date(b.planned_end).toLocaleString()}
              </div>
              {b.note && <div className="text-xs mt-1 text-faint" style={{ color: "var(--faint)" }}>{b.note}</div>}
            </div>
            <button onClick={() => deleteMutation.mutate(b.id)} className="btn btn-ghost btn-danger text-xs">
              Delete
            </button>
          </div>
        ))}
        {blasts.length === 0 && !query.isLoading && (
          <p className="px-4 md:px-5 py-8 text-sm text-muted text-center" style={{ color: "var(--muted)" }}>
            No blast windows scheduled.
          </p>
        )}
      </div>
    </div>
  );
}
