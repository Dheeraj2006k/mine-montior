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
        <h1 className="text-xl font-semibold">Contacts</h1>
        <p className="text-sm mt-1" style={{ color: "var(--offline)" }}>
          No auth/role gating in this build pass — this page and its API hold PII (phone/email)
          and are currently reachable by anyone with the URL. Treat as a known gap to close
          before any real deployment (plan §13.2: &quot;treat it like a password table&quot;).
        </p>
      </div>

      <form
        className="panel p-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <input
          className="panel-2 px-3 py-2 rounded-md"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <input
          className="panel-2 px-3 py-2 rounded-md"
          placeholder="Role (e.g. Safety Officer)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        />
        <input
          className="panel-2 px-3 py-2 rounded-md"
          placeholder="Phone (E.164, e.g. +91XXXXXXXXXX)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="panel-2 px-3 py-2 rounded-md"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="text-sm flex items-center gap-2">
          Escalation priority
          <input
            type="number"
            min={1}
            className="panel-2 px-3 py-2 rounded-md w-20"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </label>
        <button
          type="submit"
          className="rounded-md px-3 py-2 font-medium"
          style={{ background: "var(--accent)", color: "#04101f" }}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? "Adding…" : "Add contact"}
        </button>
      </form>

      <div className="panel divide-y" style={{ borderColor: "var(--border)" }}>
        {contacts.map((c) => (
          <div key={c.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium">
                {c.full_name} <span style={{ color: "var(--muted)" }}>— {c.role}</span>
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                priority {c.escalation_priority} · {c.channels.join(", ")}
                {c.phone_e164 && ` · ${c.phone_e164}`}
                {c.email && ` · ${c.email}`}
              </div>
            </div>
            <button
              onClick={() => deactivateMutation.mutate(c.id)}
              className="text-xs"
              style={{ color: "var(--offline)" }}
            >
              Deactivate
            </button>
          </div>
        ))}
        {contacts.length === 0 && !query.isLoading && (
          <p className="px-4 py-6 text-sm" style={{ color: "var(--muted)" }}>
            No active contacts. Notifications will have nothing to notify until one exists.
          </p>
        )}
      </div>
    </div>
  );
}
