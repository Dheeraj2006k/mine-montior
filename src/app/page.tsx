import Link from "next/link";
import { IrisLogo } from "@/components/layout/iris-logo";
import { PulseIcon, TwinIcon, AlertIcon, NodesIcon } from "@/components/layout/nav-icons";

const FEATURES = [
  {
    icon: NodesIcon,
    title: "Live sensor fusion",
    body:
      "Tilt, vibration, and displacement from every node, fused into one evidence score — no single cheap signal can veto an escalation on its own.",
  },
  {
    icon: PulseIcon,
    title: "Physics-informed prediction",
    body:
      "A graph neural network grounded in angle-of-draw physics estimates trend and time-to-threshold as a range, never a false-precision date.",
  },
  {
    icon: TwinIcon,
    title: "Digital twin",
    body:
      "A 3D terrain view renders predicted deformation over real mock-positioned nodes, with a time scrubber from now into the model's forecast.",
  },
  {
    icon: AlertIcon,
    title: "Human-verified escalation",
    body:
      "Every alert reaches a person — dashboard, email, SMS, then voice — and nothing is ever permanently auto-dismissed without confirmation.",
  },
];

const STEPS = [
  { label: "Sense", detail: "ESP32 nodes sample tilt, vibration, displacement" },
  { label: "Fuse", detail: "Gateway combines evidence into one risk score" },
  { label: "Predict", detail: "GNN estimates trend and time-to-threshold" },
  { label: "Verify", detail: "A human confirms — real, blast, or uncertain" },
];

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--foreground)" }} className="min-h-screen flex flex-col">
      <header className="w-full max-w-6xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IrisLogo size={26} />
          <span className="font-semibold tracking-tight">IRIS</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost text-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary text-sm">
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 pt-16 pb-20 md:pt-24 md:pb-28 text-center flex flex-col items-center">
          <div
            className="label-caveat mb-6"
            style={{ background: "var(--surface-2)" }}
          >
            AI-enabled mine subsidence monitoring
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight max-w-3xl leading-tight">
            See ground instability before it becomes ground failure
          </h1>
          <p className="text-base md:text-lg mt-6 max-w-xl" style={{ color: "var(--muted)" }}>
            IRIS fuses wireless surface sensors, satellite deformation data, and a physics-informed
            prediction pipeline into one legible, honest picture of a mine&apos;s stability — built
            for operators who need a real answer, not a black box.
          </p>
          <div className="flex items-center gap-3 mt-9">
            <Link href="/signup" className="btn btn-primary px-5 py-2.5">
              Get started
            </Link>
            <Link href="/login" className="btn px-5 py-2.5">
              Sign in
            </Link>
          </div>
        </section>

        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 pb-20 md:pb-28">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="panel p-5 flex flex-col gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: "var(--surface-2)", color: "var(--accent)" }}
                >
                  <f.icon size={18} />
                </div>
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full max-w-6xl mx-auto px-4 md:px-8 pb-24 md:pb-32">
          <div className="panel p-6 md:p-8">
            <h2 className="text-sm font-semibold mb-6 text-center">How it works</h2>
            <div className="grid gap-6 sm:grid-cols-4">
              {STEPS.map((step, i) => (
                <div key={step.label} className="flex flex-col items-center text-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ background: "var(--accent)", color: "#04101f" }}
                  >
                    {i + 1}
                  </div>
                  <div className="text-sm font-semibold">{step.label}</div>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer
        className="w-full border-t px-4 md:px-8 py-6 text-center text-xs"
        style={{ borderColor: "var(--border)", color: "var(--faint)" }}
      >
        IRIS — Intelligent RealTime Instability Sensing. Node positions shown throughout are mock,
        not GNSS. Predictions are model output, not empirically validated against real failure data.
      </footer>
    </div>
  );
}
