"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

type Contact = {
  id: number;
  full_name: string;
  role: string;
  phone_e164: string | null;
  email: string | null;
  escalation_priority: number;
  channels: string[];
  is_active: boolean;
};

export default function ContactsAdminPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiGet<Contact[]>("/api/contacts"),
  });
  const contacts = (query.data?.data ?? []).filter((c) => c.is_active);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [priority, setPriority] = useState(1);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          role,
          phone_e164: phone || null,
          email: email || null,
          escalation_priority: priority,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setFullName("");
      setRole("");
      setPhone("");
      setEmail("");
      setPriority(1);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Contacts</h1>
        <div
          className="inline-flex items-center gap-1.5 mt-2 text-xs rounded-full px-2.5 py-1"
          style={{ color: "var(--offline)", background: "color-mix(in srgb, var(--offline) 12%, transparent)" }}
        >
          Unrestricted access - no auth gating yet. Holds PII; close this before real deployment.
        </div>
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
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Role (e.g. Safety Officer)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Phone (E.164, e.g. +91XXXXXXXXXX)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="input"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="text-sm flex items-center gap-2">
          <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>Escalation priority</span>
          <input
            type="number"
            min={1}
            className="input w-20"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </label>
        <button type="submit" className="btn btn-primary sm:col-span-2" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Adding..." : "Add contact"}
        </button>
      </form>

      <div className="panel overflow-hidden">
        {contacts.map((c) => (
          <div
            key={c.id}
            className="panel-row px-4 md:px-5 py-3.5 flex items-center justify-between border-b last:border-b-0"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <div className="text-sm font-medium">
                {c.full_name}{" "}
                <span className="text-muted font-normal" style={{ color: "var(--muted)" }}>
                  - {c.role}
                </span>
              </div>
              <div className="text-xs text-muted mt-0.5" style={{ color: "var(--muted)" }}>
                priority {c.escalation_priority} - {c.channels.join(", ")}
                {c.phone_e164 && ` - ${c.phone_e164}`}
                {c.email && ` - ${c.email}`}
              </div>
            </div>
            <button onClick={() => deactivateMutation.mutate(c.id)} className="btn btn-ghost btn-danger text-xs">
              Deactivate
            </button>
          </div>
        ))}
        {contacts.length === 0 && !query.isLoading && (
          <p className="px-4 md:px-5 py-8 text-sm text-muted text-center" style={{ color: "var(--muted)" }}>
            No active contacts. Notifications will have nothing to notify until one exists.
          </p>
        )}
      </div>
    </div>
  );
}
