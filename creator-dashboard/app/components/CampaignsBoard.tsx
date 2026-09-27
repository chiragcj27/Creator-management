"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CampaignListDTO } from "@/lib/types";
import { CAMPAIGN_STATUSES } from "@/lib/types";
import { formatCurrency, formatDate, formatFollowers } from "./format";
import TopNav from "./TopNav";
import NewCampaignDialog from "./NewCampaignDialog";

export const CAMPAIGN_STATUS_TONE: Record<string, string> = {
  Planning: "border-line bg-surface-2 text-ink-2",
  Outreach: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  Active: "border-amber-500/40 bg-amber-400/15 text-amber-700 dark:text-amber-300",
  Completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Cancelled: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

const getJson = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
};

export default function CampaignsBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const status = searchParams.get("status") ?? "";
  const [items, setItems] = useState<CampaignListDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const setParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(next.toString() ? `?${next}` : "?", { scroll: false });
  };

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (searchParams.get("q")) params.set("q", searchParams.get("q")!);
    if (status) params.set("status", status);
    getJson(`/api/campaigns?${params}`)
      .then((d) => alive && setItems(d.items))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [searchParams, status]);

  useEffect(() => {
    if ((searchParams.get("q") ?? "") === q) return;
    const t = setTimeout(() => setParams({ q: q || undefined }), 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="relative mb-5 overflow-hidden rounded-3xl bg-hero text-hero-ink">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-accent/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 py-7 sm:px-8">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">
              Brand <span className="font-serif font-normal italic text-accent">campaigns</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-hero-ink/60">Shortlist creators, track outreach, deliverables and payouts, campaign by campaign.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TopNav />
            <button className="btn-primary" onClick={() => setShowNew(true)}>+ New campaign</button>
          </div>
        </div>
      </header>

      {error && <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <section className="sticky top-2 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/85 p-3 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.35)] backdrop-blur">
        <input className="input w-full sm:w-64" placeholder="Search campaign or brand" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`input max-w-[180px] pr-7 ${status ? "border-accent text-accent-ink" : ""}`} value={status} onChange={(e) => setParams({ status: e.target.value || undefined })}>
          <option value="">Any status</option>
          {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(q || status) && (
          <button className="text-sm text-accent-ink hover:underline" onClick={() => { setQ(""); setParams({ q: undefined, status: undefined }); }}>
            Clear filters
          </button>
        )}
      </section>

      {!items ? (
        <div className="py-16 text-center text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-16 text-center text-muted">
          <div className="font-serif text-3xl italic text-ink-2">No campaigns yet.</div>
          <div className="mt-1">Start one to shortlist creators and track outreach.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <CampaignCard key={c._id} c={c} />
          ))}
        </div>
      )}

      {showNew && (
        <NewCampaignDialog
          onClose={() => setShowNew(false)}
          onCreated={(id) => router.push(`/campaigns/${id}`)}
        />
      )}
    </div>
  );
}

function CampaignCard({ c }: { c: CampaignListDTO }) {
  const router = useRouter();
  const pct = c.budget ? Math.min(100, Math.round((c.summary.agreedSpend / c.budget) * 100)) : null;
  return (
    <button
      onClick={() => router.push(`/campaigns/${c._id}`)}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_12px_30px_-18px_var(--accent)]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-bold tracking-tight group-hover:text-accent-ink">{c.name}</h3>
          {c.brand && <p className="text-xs text-muted">{c.brand}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CAMPAIGN_STATUS_TONE[c.status] ?? CAMPAIGN_STATUS_TONE.Planning}`}>{c.status}</span>
      </div>
      {c.description && <p className="mb-3 line-clamp-2 text-sm text-ink-2">{c.description}</p>}
      <div className="mt-auto space-y-2 pt-2 text-xs text-muted">
        <div className="flex items-center justify-between">
          <span>{c.summary.creatorCount} creator{c.summary.creatorCount === 1 ? "" : "s"} · {formatFollowers(c.summary.totalReach)} reach</span>
          {(c.startDate || c.endDate) && <span>{formatDate(c.startDate)} – {formatDate(c.endDate)}</span>}
        </div>
        {c.budget !== null && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span>{formatCurrency(c.summary.agreedSpend)} of {formatCurrency(c.budget)}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-bar-track">
              <div className="h-1.5 rounded-full bg-bar" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
