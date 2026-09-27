"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? "Could not log in.");
      return;
    }
    // A hard navigation (not the client router) so the role — read server-side from the new
    // cookie in the root layout — can't be served stale from the client's router cache.
    window.location.href = next;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line border-t-4 border-t-accent bg-surface p-6 shadow-2xl">
        <h1 className="mb-1 font-display text-2xl font-bold tracking-tight">
          Creator <span className="font-serif font-normal italic text-accent">Hub</span>
        </h1>
        <p className="mb-5 text-sm text-muted">Enter your team password to continue.</p>
        <label className="block">
          <span className="label">Password</span>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
        </label>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button className="btn-primary mt-5 w-full justify-center" disabled={loading}>
          {loading ? "Checking…" : "Log in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
