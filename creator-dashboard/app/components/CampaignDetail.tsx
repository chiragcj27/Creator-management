"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CampaignCreatorDTO, CampaignListDTO } from "@/lib/types";
import { CAMPAIGN_STATUSES, PIPELINE_STATUSES } from "@/lib/types";
import { formatCurrency, formatFollowers } from "./format";
import { CAMPAIGN_STATUS_TONE } from "./CampaignsBoard";
import AddCreatorsDialog from "./AddCreatorsDialog";
import CampaignCreatorDrawer from "./CampaignCreatorDrawer";

type Loaded = CampaignListDTO;

const PIPELINE_TONE: Record<string, string> = {
  Shortlisted: "border-line bg-surface-2 text-ink-2",
  Invited: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  Negotiating: "border-amber-500/40 bg-amber-400/15 text-amber-700 dark:text-amber-300",
  Confirmed: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "Content in progress": "border-amber-500/40 bg-amber-400/15 text-amber-700 dark:text-amber-300",
  Submitted: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  Live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Dropped: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

const getJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  const json = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json;
};

export default function CampaignDetail({ id }: { id: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [openHandle, setOpenHandle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [details, setDetails] = useState<{
    description: string; startDate: string; endDate: string; budget: string; notes: string; platforms: string; targetGenres: string;
  } | null>(null);
  const detailsFromCampaign = (c: Loaded) => ({
    description: c.description,
    startDate: c.startDate?.slice(0, 10) ?? "",
    endDate: c.endDate?.slice(0, 10) ?? "",
    budget: c.budget?.toString() ?? "",
    notes: c.notes,
    platforms: c.platforms.join(", "),
    targetGenres: c.targetGenres.join(", "),
  });

  // Refreshes the campaign; only (re)seeds the details form the first time, so it never clobbers unsaved edits
  // triggered by an unrelated action elsewhere on the page (adding/removing a creator).
  const refetch = () =>
    getJson(`/api/campaigns/${id}`)
      .then((json: Loaded) => {
        setCampaign(json);
        setDetails((prev) => prev ?? detailsFromCampaign(json));
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    refetch();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchCampaign(body: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    try {
      const json = await getJson(`/api/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setCampaign(json);
      setMessage("Saved");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function patchCreator(handle: string, body: Record<string, unknown>) {
    const json = await getJson(`/api/campaigns/${id}/creators/${encodeURIComponent(handle)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setCampaign(json);
  }

  async function removeCreator(handle: string) {
    if (!confirm(`Remove @${handle} from this campaign?`)) return;
    await fetch(`/api/campaigns/${id}/creators/${encodeURIComponent(handle)}`, { method: "DELETE" });
    refetch();
  }

  async function deleteCampaign() {
    if (!campaign || !confirm(`Delete "${campaign.name}"? This can't be undone.`)) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.push("/campaigns");
  }

  const pipelineCounts = useMemo(() => {
    if (!campaign) return [];
    return PIPELINE_STATUSES.map((s) => ({ status: s, count: campaign.summary.byStatus[s] ?? 0 })).filter((r) => r.count > 0);
  }, [campaign]);

  if (error) return <div className="mx-auto max-w-[1400px] px-4 py-6"><div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div></div>;
  if (!campaign || !details) return <div className="mx-auto max-w-[1400px] px-4 py-16 text-center text-muted">Loading…</div>;

  const pct = campaign.budget ? Math.min(100, Math.round((campaign.summary.agreedSpend / campaign.budget) * 100)) : null;
  const existingHandles = campaign.creators.map((c) => c.handle);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-6 sm:px-6">
      <Link href="/campaigns" className="mb-3 inline-block text-sm text-accent-ink hover:underline">← Campaigns</Link>

      <header className="relative mb-5 overflow-hidden rounded-3xl bg-hero p-6 text-hero-ink sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-accent/50 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <input
              className="w-full max-w-lg border-b border-transparent bg-transparent font-display text-4xl font-extrabold leading-tight tracking-tight outline-none hover:border-hero-ink/30 focus:border-accent sm:text-5xl"
              value={campaign.name}
              onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
            />
            <input
              className="mt-2 block w-full max-w-sm border-b border-transparent bg-transparent text-sm text-hero-ink/70 outline-none placeholder:text-hero-ink/40 hover:border-hero-ink/30 focus:border-accent"
              placeholder="Brand / client"
              value={campaign.brand ?? ""}
              onChange={(e) => setCampaign({ ...campaign, brand: e.target.value })}
            />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <select
              className={`h-9 cursor-pointer rounded-full border bg-surface px-3 text-sm font-semibold outline-none ${CAMPAIGN_STATUS_TONE[campaign.status] ?? CAMPAIGN_STATUS_TONE.Planning}`}
              value={campaign.status}
              onChange={(e) => patchCampaign({ status: e.target.value })}
            >
              {CAMPAIGN_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <div className="flex gap-2">
              <a className="btn-ghost" href={`/api/campaigns/${id}/export`}>Export CSV</a>
              <button className="btn-ghost" onClick={deleteCampaign}>Delete</button>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Creators" value={campaign.summary.creatorCount} tone="accent" />
        <Stat label="Estimated reach" value={formatFollowers(campaign.summary.totalReach)} sub="Sum of followers, active creators" />
        <Stat label="Agreed spend" value={formatCurrency(campaign.summary.agreedSpend)} sub={campaign.budget ? `${pct}% of ${formatCurrency(campaign.budget)} budget` : "No budget set"} progress={campaign.budget ? campaign.summary.agreedSpend / campaign.budget : undefined} />
        <Stat label="Paid so far" value={formatCurrency(campaign.summary.paidSpend)} />
      </section>

      {pipelineCounts.length > 0 && (
        <section className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-4">
          {pipelineCounts.map((r) => (
            <span key={r.status} className={`rounded-full border px-3 py-1 text-xs font-medium ${PIPELINE_TONE[r.status] ?? PIPELINE_TONE.Shortlisted}`}>
              {r.count} {r.status}
            </span>
          ))}
        </section>
      )}

      <section className="mb-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-display text-lg font-bold tracking-tight">Campaign details</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Start date"><input type="date" className="input w-full" value={details.startDate} onChange={(e) => setDetails({ ...details, startDate: e.target.value })} /></Field>
          <Field label="End date"><input type="date" className="input w-full" value={details.endDate} onChange={(e) => setDetails({ ...details, endDate: e.target.value })} /></Field>
          <Field label="Budget (₹)"><input className="input w-full" inputMode="numeric" value={details.budget} onChange={(e) => setDetails({ ...details, budget: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Platforms (comma separated)"><input className="input w-full" value={details.platforms} onChange={(e) => setDetails({ ...details, platforms: e.target.value })} /></Field>
          <div className="col-span-2 sm:col-span-4"><Field label="Target genres (comma separated)"><input className="input w-full" value={details.targetGenres} onChange={(e) => setDetails({ ...details, targetGenres: e.target.value })} /></Field></div>
          <div className="col-span-2 sm:col-span-4"><Field label="Brief / description"><textarea className="input h-20 w-full py-2" value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} /></Field></div>
          <div className="col-span-2 sm:col-span-4"><Field label="Internal notes"><textarea className="input h-20 w-full py-2" value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} placeholder="Client contacts, invoicing notes, learnings…" /></Field></div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-3">
          {message && <span className={`text-sm ${message === "Saved" ? "text-good" : "text-danger"}`}>{message}</span>}
          <button
            className="btn-primary"
            disabled={saving}
            onClick={() =>
              patchCampaign({
                name: campaign.name,
                brand: campaign.brand,
                description: details.description,
                startDate: details.startDate || null,
                endDate: details.endDate || null,
                budget: details.budget || null,
                notes: details.notes,
                platforms: details.platforms.split(",").map((s) => s.trim()).filter(Boolean),
                targetGenres: details.targetGenres.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          >
            {saving ? "Saving…" : "Save details"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg font-bold tracking-tight">Creators ({campaign.creators.length})</h2>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add creators</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Creator</th>
                <th className="px-4 py-2 font-medium text-right">Followers</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Rate</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Deliverables</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {campaign.creators.map((c) => (
                <CreatorRow key={c.handle} c={c} onPatch={(body) => patchCreator(c.handle, body)} onOpen={() => setOpenHandle(c.handle)} onRemove={() => removeCreator(c.handle)} />
              ))}
              {campaign.creators.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted">
                    <div className="font-serif text-3xl italic text-ink-2">No creators shortlisted yet.</div>
                    <div className="mt-1">Add creators from your roster to start this campaign&apos;s pipeline.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd && (
        <AddCreatorsDialog
          existingHandles={existingHandles}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            refetch();
          }}
          campaignId={id}
        />
      )}
      {openHandle && (
        <CampaignCreatorDrawer
          campaignId={id}
          creator={campaign.creators.find((c) => c.handle === openHandle)!}
          onClose={() => setOpenHandle(null)}
          onChanged={(json) => setCampaign(json)}
        />
      )}
    </div>
  );
}

function CreatorRow({ c, onPatch, onOpen, onRemove }: { c: CampaignCreatorDTO; onPatch: (body: Record<string, unknown>) => void; onOpen: () => void; onRemove: () => void }) {
  const done = c.deliverables.filter((d) => d.status === "Approved" || d.status === "Live").length;

  return (
    <tr className="border-t border-line hover:bg-accent-soft/20">
      <td className="cursor-pointer px-4 py-2.5" onClick={onOpen}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            {c.name ?? <span className="text-muted">No name</span>}
            {c.missing && <span title="No longer in the creator roster" className="text-xs text-warn">⚠</span>}
          </div>
          <span className="text-xs text-muted">@{c.handle}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right font-display text-base font-semibold tabular-nums">{formatFollowers(c.followers)}</td>
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <select
          className={`h-7 cursor-pointer rounded-full border px-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/30 ${PIPELINE_TONE[c.status] ?? PIPELINE_TONE.Shortlisted}`}
          value={c.status}
          onChange={(e) => onPatch({ status: e.target.value })}
        >
          {PIPELINE_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          key={c.rate ?? "empty"}
          className="input h-8 w-24"
          inputMode="numeric"
          defaultValue={c.rate?.toString() ?? ""}
          onChange={(e) => {
            e.target.value = e.target.value.replace(/\D/g, "");
          }}
          onBlur={(e) => {
            const v = e.target.value;
            const changed = v === "" ? c.rate !== null : Number(v) !== c.rate;
            if (changed) onPatch({ rate: v || null });
          }}
        />
      </td>
      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={c.paid} onChange={(e) => onPatch({ paid: e.target.checked })} />
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-2">
        {c.deliverables.length ? `${done}/${c.deliverables.length} done` : <span className="text-muted">None set</span>}
      </td>
      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <button className="text-xs text-muted hover:text-danger" onClick={onRemove}>Remove</button>
      </td>
    </tr>
  );
}

function Stat({ label, value, sub, tone, progress }: { label: string; value: number | string; sub?: string; tone?: "accent"; progress?: number }) {
  const accent = tone === "accent";
  return (
    <div className={`rounded-2xl border px-5 py-4 ${accent ? "border-accent bg-accent text-white" : "border-line bg-surface"}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${accent ? "text-white/80" : "text-muted"}`}>{label}</div>
      <div className="mt-2 font-display text-2xl font-extrabold leading-none tracking-tight tabular-nums sm:text-3xl">{value}</div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-bar-track">
          <div className="h-1.5 rounded-full bg-bar" style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }} />
        </div>
      )}
      {sub && <div className={`mt-2 text-xs ${accent ? "text-white/80" : "text-muted"}`}>{sub}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
