"use client";

import { useEffect, useState } from "react";
import { CAMPAIGN_STATUSES } from "@/lib/types";

const PLATFORM_OPTIONS = ["Instagram", "YouTube", "Facebook", "X", "LinkedIn"];

export default function NewCampaignDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: "", brand: "", description: "", status: "Planning", startDate: "", endDate: "", budget: "", notes: "" });
  const [platforms, setPlatforms] = useState<string[]>(["Instagram"]);
  const [targetGenres, setTargetGenres] = useState<string[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then((m) => setAllGenres(m.allGenres ?? [])).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, budget: f.budget || null, platforms, targetGenres }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setError(json.error ?? "Could not create campaign");
    onCreated(json._id);
  }

  const input = (key: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input w-full" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line border-t-4 border-t-accent bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">New <span className="font-serif font-normal italic text-accent">campaign</span></h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">{input("name", "Campaign name *", { required: true, placeholder: "e.g. Diwali Glow — Nykaa", autoFocus: true })}</div>
          {input("brand", "Brand / client")}
          <label className="block">
            <span className="label">Status</span>
            <select className="input w-full" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {CAMPAIGN_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          {input("startDate", "Start date", { type: "date" })}
          {input("endDate", "End date", { type: "date" })}
          {input("budget", "Total budget (₹)", { inputMode: "numeric", placeholder: "e.g. 150000" })}
          <div className="col-span-2">
            <span className="label">Platforms</span>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_OPTIONS.map((p) => {
                const on = platforms.includes(p);
                return (
                  <button type="button" key={p} onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2"}`}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          {allGenres.length > 0 && (
            <div className="col-span-2">
              <span className="label">Target genres (who should this campaign reach)</span>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {allGenres.map((g) => {
                  const on = targetGenres.includes(g);
                  return (
                    <button type="button" key={g} onClick={() => setTargetGenres(on ? targetGenres.filter((x) => x !== g) : [...targetGenres, g])}
                      className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2"}`}>
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="col-span-2">
            <span className="label">Brief / description</span>
            <textarea className="input h-20 w-full py-2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What the brand wants, deliverables, tone…" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create campaign"}</button>
        </div>
      </form>
    </div>
  );
}
