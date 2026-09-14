"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/auth/auth-card";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // No session back means the Supabase project requires email
    // confirmation before a session is issued.
    setCheckEmail(true);
    setLoading(false);
  }

  if (checkEmail) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="Intelligent Real-time Instability Sensing"
        footer={
          <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
            Back to sign in
          </Link>
        }
      >
        <p className="text-sm text-center" style={{ color: "var(--muted)" }}>
          We sent a confirmation link to <span style={{ color: "var(--foreground)" }}>{email}</span>. Click it to
          activate your account, then sign in.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create an account"
      subtitle="Intelligent Real-time Instability Sensing"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>
            Full name
          </span>
          <input
            type="text"
            required
            autoComplete="name"
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Safety Officer"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@site.com"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-faint" style={{ color: "var(--faint)" }}>
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>

        {error && (
          <p className="text-xs" style={{ color: "var(--offline)" }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
