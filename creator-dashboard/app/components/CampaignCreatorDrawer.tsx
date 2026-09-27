"use client";

import { useEffect, useRef, useState } from "react";
import type { CampaignCreatorDTO, CampaignListDTO, DeliverableDTO } from "@/lib/types";
import { DELIVERABLE_STATUSES, DELIVERABLE_TYPES, PIPELINE_STATUSES } from "@/lib/types";
import { formatFollowers } from "./format";

const newDeliverable = (): DeliverableDTO => ({
  id: crypto.randomUUID(),
  type: "Reel",
  dueDate: null,
  status: "Pending",
  link: null,
  notes: "",
});

export default function CampaignCreatorDrawer({
  campaignId,
  creator,
  onClose,
  onChanged,
}: {
  campaignId: string;
  creator: CampaignCreatorDTO;
  onClose: () => void;
  onChanged: (campaign: CampaignListDTO) => void;
}) {
  const [status, setStatus] = useState(creator.status);
  const [rate, setRate] = useState(creator.rate?.toString() ?? "");
  const [paid, setPaid] = useState(creator.paid);
  const [notes, setNotes] = useState(creator.notes);
  const [deliverables, setDeliverables] = useState<DeliverableDTO[]>(creator.deliverables);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/campaigns/${campaignId}/creators/${encodeURIComponent(creator.handle)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        rate: rate === "" ? null : Number(rate),
        paid,
        notes,
        deliverables: deliverables.map((d) => ({ ...d, dueDate: d.dueDate || null })),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setMessage(json.error ?? "Save failed");
    onChanged(json);
    setMessage("Saved");
  }

  async function remove() {
    if (!confirm(`Remove @${creator.handle} from this campaign?`)) return;
    await fetch(`/api/campaigns/${campaignId}/creators/${encodeURIComponent(creator.handle)}`, { method: "DELETE" });
    onClose();
  }

  const updateDeliverable = (id: string, patch: Partial<DeliverableDTO>) =>
    setDeliverables((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const removeDeliverable = (id: string) => setDeliverables((ds) => ds.filter((d) => d.id !== id));

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <aside className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-line border-t-4 border-t-accent px-5 py-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">{creator.name ?? `@${creator.handle}`}</h2>
            <a href={creator.instagramUrl} target="_blank" rel="noreferrer" className="text-sm text-accent-ink hover:underline">
              @{creator.handle} · {formatFollowers(creator.followers)} followers ↗
            </a>
          </div>
          <button className="btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Pipeline status</span>
              <select className="input w-full" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {PIPELINE_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Agreed rate (₹)</span>
              <input className="input w-full" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className="flex items-center gap-2 pt-5">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
              <span className="text-sm">Payment sent</span>
            </label>
          </section>

          <section>
            <span className="label">Notes for this campaign</span>
            <textarea className="input h-20 w-full py-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Negotiation notes, usage rights, whatever the next person needs to know…" />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="label !mb-0">Deliverables</span>
              <button type="button" className="text-xs text-accent-ink hover:underline" onClick={() => setDeliverables((ds) => [...ds, newDeliverable()])}>+ Add deliverable</button>
            </div>
            {deliverables.length === 0 && <p className="text-xs text-muted">Nothing tracked yet.</p>}
            <div className="space-y-2">
              {deliverables.map((d) => (
                <div key={d.id} className="rounded-lg border border-line p-2.5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <select className="input h-8" value={d.type} onChange={(e) => updateDeliverable(d.id, { type: e.target.value as typeof d.type })}>
                      {DELIVERABLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <input type="date" className="input h-8" value={d.dueDate?.slice(0, 10) ?? ""} onChange={(e) => updateDeliverable(d.id, { dueDate: e.target.value || null })} />
                    <select className="input h-8" value={d.status} onChange={(e) => updateDeliverable(d.id, { status: e.target.value as typeof d.status })}>
                      {DELIVERABLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => removeDeliverable(d.id)}>Remove</button>
                  </div>
                  <input
                    className="input mt-2 h-8 w-full"
                    placeholder="Link to content (once posted)"
                    value={d.link ?? ""}
                    onChange={(e) => updateDeliverable(d.id, { link: e.target.value || null })}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <button className="text-sm text-danger hover:underline" onClick={remove}>Remove from campaign</button>
          <div className="flex items-center gap-3">
            {message && <span className={`text-sm ${message === "Saved" ? "text-good" : "text-danger"}`}>{message}</span>}
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
