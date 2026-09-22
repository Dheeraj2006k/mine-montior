"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthCard } from "@/components/auth/auth-card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "inactive" ? "This account has been deactivated. Contact your site administrator." : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const next = searchParams.get("next") ?? "/dashboard";
    router.push(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Intelligent Real-time Instability Sensing"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
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
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </label>

        {error && (
          <p className="text-xs" style={{ color: "var(--offline)" }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
