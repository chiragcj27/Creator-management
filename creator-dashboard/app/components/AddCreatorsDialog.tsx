"use client";

import { useEffect, useState } from "react";
import type { CreatorDTO } from "@/lib/types";
import { formatFollowers } from "./format";

export default function AddCreatorsDialog({
  campaignId,
  existingHandles,
  onClose,
  onAdded,
}: {
  campaignId: string;
  existingHandles: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<CreatorDTO[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const existing = new Set(existingHandles);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ pageSize: "40", sort: "followers", dir: "desc" });
    if (q) params.set("q", q);
    fetch(`/api/creators?${params}`)
      .then((r) => r.json())
      .then((d) => alive && setItems(d.items))
      .catch(() => alive && setError("Could not load creators"));
    return () => {
      alive = false;
    };
  }, [q]);

  async function submit() {
    if (!picked.length) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/creators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handles: picked }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) return setError(json?.error ?? "Could not add creators");
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line border-t-4 border-t-accent bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line px-6 py-4">
          <h2 className="mb-3 font-display text-2xl font-bold tracking-tight">Add <span className="font-serif font-normal italic text-accent">creators</span></h2>
          <input className="input w-full" placeholder="Search your roster by name, @handle, city…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {!items ? (
            <div className="py-10 text-center text-sm text-muted">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">No creators match.</div>
          ) : (
            items.map((c) => {
              const already = existing.has(c.handle);
              const on = picked.includes(c.handle);
              return (
                <label
                  key={c.handle}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${already ? "opacity-50" : "cursor-pointer hover:bg-surface-2"}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    disabled={already}
                    checked={on || already}
                    onChange={(e) => setPicked(e.target.checked ? [...picked, c.handle] : picked.filter((h) => h !== c.handle))}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.name ?? <span className="text-muted">No name</span>} <span className="text-xs font-normal text-muted">@{c.handle}</span></div>
                    <div className="flex flex-wrap gap-1 text-xs text-muted">
                      {c.city && <span>{c.city}</span>}
                      {c.genres.slice(0, 2).map((g) => <span key={g} className="chip">{g}</span>)}
                    </div>
                  </div>
                  <div className="shrink-0 font-display text-sm font-semibold tabular-nums text-ink-2">{formatFollowers(c.followers)}</div>
                  {already && <span className="shrink-0 text-xs text-muted">Added</span>}
                </label>
              );
            })
          )}
        </div>

        {error && <p className="px-6 pb-2 text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-line px-6 py-3">
          <span className="text-sm text-muted">{picked.length} selected</span>
          <div className="flex gap-2">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={!picked.length || saving} onClick={submit}>{saving ? "Adding…" : `Add ${picked.length || ""}`}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
