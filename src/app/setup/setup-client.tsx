"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IrisIconMark, IrisWordmark } from "@/components/layout/iris-logo";
import type { LongwallGeometry, BordAndPillarGeometry } from "@/lib/schemas/site-config";

type MineType = "longwall" | "bord_and_pillar";
type Channel = "whatsapp" | "sms" | "email" | "voice";

type ContactDraft = {
  full_name: string;
  role: string;
  phone_e164: string;
  email: string;
  escalation_priority: number;
  channels: Channel[];
};

const STEPS = [
  "Mine identity",
  "Geometry",
  "Geology & state",
  "Data sources",
  "Emergency contacts",
  "Review & confirm",
] as const;

const emptyLongwall: LongwallGeometry = {
  panel_boundary_note: "",
  depth_m: 0,
  extraction_thickness_m: 0,
  extraction_method: "",
  status: "planned",
  face_direction: "",
  face_position_pct: undefined,
  expected_progression_rate: "",
};

const emptyBordAndPillar: BordAndPillarGeometry = {
  pillar_width_m: 0,
  gallery_width_m: 0,
  depth_m: 0,
  seam_thickness_m: 0,
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs" style={{ color: "var(--faint)" }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11px]" style={{ color: "var(--faint)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function AssumedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="text-[11px] font-medium rounded-full px-2 py-1 border transition-colors self-start"
      style={{
        color: checked ? "var(--warning)" : "var(--normal)",
        background: checked
          ? "color-mix(in srgb, var(--warning) 12%, transparent)"
          : "color-mix(in srgb, var(--normal) 12%, transparent)",
        borderColor: checked
          ? "color-mix(in srgb, var(--warning) 35%, var(--border))"
          : "color-mix(in srgb, var(--normal) 35%, var(--border))",
      }}
    >
      {checked ? "Assumed / Earth Engine estimate" : "Known value / measured"}
    </button>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  // Step 1
  const [siteName, setSiteName] = useState("");
  const [mineType, setMineType] = useState<MineType>("longwall");
  const [aoiLat, setAoiLat] = useState("");
  const [aoiLon, setAoiLon] = useState("");

  // Step 2
  const [longwall, setLongwall] = useState<LongwallGeometry>(emptyLongwall);
  const [bordAndPillar, setBordAndPillar] = useState<BordAndPillarGeometry>(emptyBordAndPillar);

  // Step 3 — geology + current state
  const [rockToSoilRatio, setRockToSoilRatio] = useState("");
  const [rockToSoilAssumed, setRockToSoilAssumed] = useState(true);
  const [brittlenessIndex, setBrittlenessIndex] = useState("");
  const [brittlenessAssumed, setBrittlenessAssumed] = useState(true);
  const [rockDensity, setRockDensity] = useState("");
  const [rockDensityAssumed, setRockDensityAssumed] = useState(true);
  const [extractionPct, setExtractionPct] = useState("");
  const [pillarConfigStatus, setPillarConfigStatus] = useState("");
  const [goafNotes, setGoafNotes] = useState("");

  // Step 4 — data sources
  const [insarAoiConfirmed, setInsarAoiConfirmed] = useState(false);
  const [earthEngineConnected, setEarthEngineConnected] = useState(false);
  const [useStaticGeologyFixture, setUseStaticGeologyFixture] = useState(true);

  // Step 5 — contacts
  const [contacts, setContacts] = useState<ContactDraft[]>([
    { full_name: "", role: "", phone_e164: "", email: "", escalation_priority: 1, channels: ["email", "sms"] },
  ]);

  function updateContact(i: number, patch: Partial<ContactDraft>) {
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function toggleChannel(i: number, ch: Channel) {
    setContacts((prev) =>
      prev.map((c, idx) => {
        if (idx !== i) return c;
        const has = c.channels.includes(ch);
        return { ...c, channels: has ? c.channels.filter((x) => x !== ch) : [...c.channels, ch] };
      }),
    );
  }

  function canAdvance(): boolean {
    if (step === 0) return siteName.trim().length > 0 && aoiLat.trim() !== "" && aoiLon.trim() !== "";
    if (step === 1) {
      if (mineType === "longwall") {
        return longwall.panel_boundary_note.trim().length > 0 && longwall.depth_m > 0 && longwall.extraction_thickness_m > 0;
      }
      return bordAndPillar.pillar_width_m > 0 && bordAndPillar.gallery_width_m > 0 && bordAndPillar.depth_m > 0;
    }
    return true;
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const is_assumed: Record<string, boolean> = {
      rock_to_soil_ratio: rockToSoilAssumed,
      brittleness_index: brittlenessAssumed,
      rock_density: rockDensityAssumed,
    };

    const geometry =
      mineType === "longwall"
        ? {
            ...longwall,
            face_position_pct: longwall.status === "active" ? longwall.face_position_pct : undefined,
          }
        : bordAndPillar;

    const payload = {
      mine_type: mineType,
      site_name: siteName,
      aoi_latitude: Number(aoiLat),
      aoi_longitude: Number(aoiLon),
      geometry,
      geology: {
        rock_to_soil_ratio: Number(rockToSoilRatio) || 0,
        brittleness_index: Number(brittlenessIndex) || 0,
        rock_density: Number(rockDensity) || 0,
      },
      mining_state: {
        extraction_pct: Number(extractionPct) || 0,
        pillar_config_status: pillarConfigStatus || "not specified",
        goaf_notes: goafNotes,
      },
      data_sources: {
        insar_aoi_confirmed: insarAoiConfirmed,
        earth_engine_connected: earthEngineConnected,
        use_static_geology_fixture: useStaticGeologyFixture,
      },
      is_assumed,
      emergency_contacts: contacts
        .filter((c) => c.full_name.trim().length > 0)
        .map((c) => ({ ...c, email: c.email || undefined, phone_e164: c.phone_e164 || undefined })),
    };

    try {
      const res = await fetch("/api/site-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Setup failed with status ${res.status}`);
      }
      setSubmitting(false);
      setJustCompleted(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
      setSubmitting(false);
    }
  }

  if (justCompleted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-6" style={{ background: "var(--bg)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <IrisIconMark size={30} priority className="iris-brand-eye" />
          <IrisWordmark width={100} priority className="iris-brand-wordmark" />
        </Link>
        <div className="panel p-6 md:p-8 w-full max-w-md flex flex-col items-center gap-4 text-center">
          <span className="status-dot" style={{ width: 10, height: 10, color: "var(--normal)", background: "var(--normal)" }} />
          <div>
            <h1 className="text-lg font-semibold">Site configured</h1>
            <p className="text-sm mt-1.5" style={{ color: "var(--muted)" }}>
              {siteName || "Your site"} is set up as {mineType === "longwall" ? "Longwall" : "Bord-and-Pillar"}.
              Next, register a physical sensor node so the dashboard has something to show.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full">
            <Link href="/nodes" className="btn btn-primary flex-1">
              Register your first node &rarr;
            </Link>
            <Link href="/dashboard" className="btn flex-1">
              Go to dashboard &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-8" style={{ background: "var(--bg)" }}>
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <IrisIconMark size={30} priority className="iris-brand-eye" />
        <IrisWordmark width={100} priority className="iris-brand-wordmark" />
      </Link>

      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">Site setup</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Runs once before the dashboard is usable. Every field you mark &ldquo;assumed&rdquo; is flagged
            everywhere it&apos;s displayed - never silently presented as measured.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{
                color: i === step ? "var(--foreground)" : i < step ? "var(--normal)" : "var(--faint)",
                background: i === step ? "var(--surface-2)" : "transparent",
                border: `1px solid ${i === step ? "var(--border-strong)" : "var(--border)"}`,
              }}
            >
              <span>{i < step ? "✓" : i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>

        <div className="panel p-5 md:p-6 flex flex-col gap-4">
          {step === 0 && (
            <>
              <Field label="Mine / site name">
                <input className="input" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="e.g. Jharia Coalfield Site 1" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="AOI latitude (WGS84)" hint="Anchor to a real location - InSAR/Earth Engine data is only meaningful over real coordinates.">
                  <input className="input" type="number" step="any" value={aoiLat} onChange={(e) => setAoiLat(e.target.value)} placeholder="23.7644" />
                </Field>
                <Field label="AOI longitude (WGS84)">
                  <input className="input" type="number" step="any" value={aoiLon} onChange={(e) => setAoiLon(e.target.value)} placeholder="86.4131" />
                </Field>
              </div>
              <Field label="Mine type" hint="Master switch - determines which geometry form and downstream twin view is used.">
                <div className="flex gap-2">
                  {(["longwall", "bord_and_pillar"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMineType(t)}
                      className="btn flex-1"
                      style={
                        mineType === t
                          ? { background: "linear-gradient(135deg, var(--green), var(--accent))", color: "#021016", borderColor: "var(--accent-strong)", fontWeight: 600 }
                          : undefined
                      }
                    >
                      {t === "longwall" ? "Longwall" : "Bord-and-Pillar"}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 1 && mineType === "longwall" && (
            <>
              <Field label="Panel boundary" hint="Polygon or simple corner coordinates - free text for this prototype.">
                <textarea className="input" rows={2} value={longwall.panel_boundary_note} onChange={(e) => setLongwall((g) => ({ ...g, panel_boundary_note: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Depth (H, m)">
                  <input className="input" type="number" value={longwall.depth_m || ""} onChange={(e) => setLongwall((g) => ({ ...g, depth_m: Number(e.target.value) }))} />
                </Field>
                <Field label="Extraction thickness (m)">
                  <input className="input" type="number" value={longwall.extraction_thickness_m || ""} onChange={(e) => setLongwall((g) => ({ ...g, extraction_thickness_m: Number(e.target.value) }))} />
                </Field>
              </div>
              <Field label="Extraction method label">
                <input className="input" value={longwall.extraction_method} onChange={(e) => setLongwall((g) => ({ ...g, extraction_method: e.target.value }))} />
              </Field>
              <Field label="Status">
                <div className="flex gap-2">
                  {(["planned", "active", "completed"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLongwall((g) => ({ ...g, status: s }))}
                      className="btn flex-1 capitalize"
                      style={longwall.status === s ? { background: "var(--surface-hover)", borderColor: "var(--border-strong)" } : undefined}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              {longwall.status === "active" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 panel-2 rounded-lg p-3">
                  <Field label="Face direction">
                    <input className="input" value={longwall.face_direction} onChange={(e) => setLongwall((g) => ({ ...g, face_direction: e.target.value }))} />
                  </Field>
                  <Field label="Face position (%)">
                    <input className="input" type="number" min={0} max={100} value={longwall.face_position_pct ?? ""} onChange={(e) => setLongwall((g) => ({ ...g, face_position_pct: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Expected progression rate" hint="Illustrative if not real production data.">
                    <input className="input" value={longwall.expected_progression_rate} onChange={(e) => setLongwall((g) => ({ ...g, expected_progression_rate: e.target.value }))} />
                  </Field>
                </div>
              )}
            </>
          )}

          {step === 1 && mineType === "bord_and_pillar" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Pillar width (m)">
                <input className="input" type="number" value={bordAndPillar.pillar_width_m || ""} onChange={(e) => setBordAndPillar((g) => ({ ...g, pillar_width_m: Number(e.target.value) }))} />
              </Field>
              <Field label="Gallery / bord width (m)">
                <input className="input" type="number" value={bordAndPillar.gallery_width_m || ""} onChange={(e) => setBordAndPillar((g) => ({ ...g, gallery_width_m: Number(e.target.value) }))} />
              </Field>
              <Field label="Depth (m)">
                <input className="input" type="number" value={bordAndPillar.depth_m || ""} onChange={(e) => setBordAndPillar((g) => ({ ...g, depth_m: Number(e.target.value) }))} />
              </Field>
              <Field label="Seam thickness (m)">
                <input className="input" type="number" value={bordAndPillar.seam_thickness_m || ""} onChange={(e) => setBordAndPillar((g) => ({ ...g, seam_thickness_m: Number(e.target.value) }))} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-3">
                <div className="panel-2 rounded-lg p-3 flex flex-col gap-2">
                  <Field label="Rock-to-soil ratio">
                    <input className="input" type="number" step="any" value={rockToSoilRatio} onChange={(e) => setRockToSoilRatio(e.target.value)} />
                  </Field>
                  <AssumedToggle checked={rockToSoilAssumed} onChange={setRockToSoilAssumed} />
                </div>
                <div className="panel-2 rounded-lg p-3 flex flex-col gap-2">
                  <Field label="Brittleness index (0-1)">
                    <input className="input" type="number" step="any" min={0} max={1} value={brittlenessIndex} onChange={(e) => setBrittlenessIndex(e.target.value)} />
                  </Field>
                  <AssumedToggle checked={brittlenessAssumed} onChange={setBrittlenessAssumed} />
                </div>
                <div className="panel-2 rounded-lg p-3 flex flex-col gap-2">
                  <Field label="Rock density (kg/m³)">
                    <input className="input" type="number" step="any" value={rockDensity} onChange={(e) => setRockDensity(e.target.value)} />
                  </Field>
                  <AssumedToggle checked={rockDensityAssumed} onChange={setRockDensityAssumed} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Extraction percentage">
                  <input className="input" type="number" min={0} max={100} value={extractionPct} onChange={(e) => setExtractionPct(e.target.value)} />
                </Field>
                <Field label="Pillar configuration / removal status">
                  <input className="input" value={pillarConfigStatus} onChange={(e) => setPillarConfigStatus(e.target.value)} />
                </Field>
              </div>
              <Field label="Goaf development notes" hint="Manually-updated - dashboard shows a persistent last-updated timestamp for this.">
                <textarea className="input" rows={2} value={goafNotes} onChange={(e) => setGoafNotes(e.target.value)} />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <label className="flex items-start gap-2.5 panel-2 rounded-lg p-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={insarAoiConfirmed} onChange={(e) => setInsarAoiConfirmed(e.target.checked)} />
                <span className="text-sm">
                  Confirm/select AOI for the InSAR team&apos;s grid
                  <span className="block text-xs mt-0.5" style={{ color: "var(--faint)" }}>
                    Data freshness will display once the InSAR pipeline connects.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 panel-2 rounded-lg p-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={earthEngineConnected} onChange={(e) => setEarthEngineConnected(e.target.checked)} />
                <span className="text-sm">
                  Earth Engine is connected
                  <span className="block text-xs mt-0.5" style={{ color: "var(--faint)" }}>
                    Leave unchecked to use the static geology fixture fallback below.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 panel-2 rounded-lg p-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={useStaticGeologyFixture} onChange={(e) => setUseStaticGeologyFixture(e.target.checked)} />
                <span className="text-sm">
                  Use static geology fixture
                  <span className="block text-xs mt-0.5" style={{ color: "var(--faint)" }}>
                    Fallback while Earth Engine access isn&apos;t yet approved.
                  </span>
                </span>
              </label>
            </>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-3">
              {contacts.map((c, i) => (
                <div key={i} className="panel-2 rounded-lg p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: "var(--faint)" }}>
                      Contact {i + 1} - priority {c.escalation_priority}
                    </span>
                    {contacts.length > 1 && (
                      <button type="button" className="text-xs" style={{ color: "var(--offline)" }} onClick={() => setContacts((prev) => prev.filter((_, idx) => idx !== i))}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="Name">
                      <input className="input" value={c.full_name} onChange={(e) => updateContact(i, { full_name: e.target.value })} />
                    </Field>
                    <Field label="Role">
                      <input className="input" value={c.role} onChange={(e) => updateContact(i, { role: e.target.value })} placeholder="Safety Officer" />
                    </Field>
                    <Field label="Phone (E.164)">
                      <input className="input" value={c.phone_e164} onChange={(e) => updateContact(i, { phone_e164: e.target.value })} placeholder="+91..." />
                    </Field>
                    <Field label="Email">
                      <input className="input" type="email" value={c.email} onChange={(e) => updateContact(i, { email: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Escalation priority" hint="First contact tried first, falling through on no-answer/no-authorization.">
                    <input className="input w-24" type="number" min={1} value={c.escalation_priority} onChange={(e) => updateContact(i, { escalation_priority: Number(e.target.value) })} />
                  </Field>
                  <div>
                    <span className="text-xs" style={{ color: "var(--faint)" }}>
                      Channel preferences
                    </span>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {(["whatsapp", "sms", "email", "voice"] as const).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleChannel(i, ch)}
                          className="text-xs px-2.5 py-1 rounded-full border capitalize"
                          style={{
                            color: c.channels.includes(ch) ? "var(--foreground)" : "var(--faint)",
                            background: c.channels.includes(ch) ? "var(--surface-hover)" : "transparent",
                            borderColor: c.channels.includes(ch) ? "var(--border-strong)" : "var(--border)",
                          }}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn self-start"
                onClick={() =>
                  setContacts((prev) => [
                    ...prev,
                    { full_name: "", role: "", phone_e164: "", email: "", escalation_priority: prev.length + 1, channels: ["email"] },
                  ])
                }
              >
                + Add contact
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-col gap-4">
              <SummaryRow label="Site" value={siteName || "-"} />
              <SummaryRow label="Mine type" value={mineType === "longwall" ? "Longwall" : "Bord-and-Pillar"} />
              <SummaryRow label="AOI" value={`${aoiLat || "-"}, ${aoiLon || "-"}`} />
              <SummaryRow
                label="Geology"
                value={
                  <div className="flex flex-col gap-1">
                    <span>Rock-to-soil {rockToSoilRatio || "-"} {rockToSoilAssumed && <AssumedTag />}</span>
                    <span>Brittleness {brittlenessIndex || "-"} {brittlenessAssumed && <AssumedTag />}</span>
                    <span>Density {rockDensity || "-"} {rockDensityAssumed && <AssumedTag />}</span>
                  </div>
                }
              />
              <SummaryRow label="Mining state" value={`${extractionPct || 0}% extraction - ${pillarConfigStatus || "not specified"}`} />
              <SummaryRow
                label="Data sources"
                value={`InSAR AOI ${insarAoiConfirmed ? "confirmed" : "pending"} - Earth Engine ${earthEngineConnected ? "connected" : "fallback fixture"}`}
              />
              <SummaryRow
                label="Emergency contacts"
                value={contacts.filter((c) => c.full_name).length === 0 ? "None added" : contacts.filter((c) => c.full_name).map((c) => `${c.full_name} (${c.role})`).join(", ")}
              />
              {error && (
                <p className="text-xs" style={{ color: "var(--offline)" }}>
                  {error}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <button type="button" className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn btn-primary" disabled={!canAdvance()} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Continue
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? "Saving..." : "Confirm & unlock dashboard"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssumedTag() {
  return (
    <span className="label-caveat ml-1" style={{ fontSize: "0.62rem" }}>
      assumed
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 panel-2 rounded-lg p-3">
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
