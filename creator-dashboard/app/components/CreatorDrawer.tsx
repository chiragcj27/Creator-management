"use client";

import { useEffect, useRef, useState } from "react";
import type { CreatorDTO } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { GENRE_STATUS_LABEL, formatFollowers, formatPhone } from "./format";

interface Form {
  name: string;
  followers: string;
  gender: string;
  status: string;
  genres: string[];
  phones: string;
  emails: string;
  city: string;
  state: string;
  manager: string;
  tags: string;
  notes: string;
}

const toForm = (c: CreatorDTO): Form => ({
  name: c.name ?? "",
  followers: c.followers?.toString() ?? "",
  gender: c.gender ?? "",
  status: c.status,
  genres: c.genres,
  phones: c.phones.join(", "),
  emails: c.emails.join(", "),
  city: c.city ?? "",
  state: c.state ?? "",
  manager: c.manager ?? "",
  tags: c.tags.join(", "),
  notes: c.notes,
});

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function CreatorDrawer({ handle, genres, onClose, onChanged }: { handle: string; genres: string[]; onClose: () => void; onChanged: () => void }) {
  const [creator, setCreator] = useState<CreatorDTO | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/creators/${encodeURIComponent(handle)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!alive) return;
        if (!r.ok) return setMessage(json.error ?? "Could not load creator");
        setCreator(json);
        setForm(toForm(json));
      });
    return () => {
      alive = false;
    };
  }, [handle]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const genresChanged = creator && form && [...form.genres].sort().join() !== [...creator.genres].sort().join();

  async function save(extra: Record<string, unknown> = {}) {
    if (!form || !creator) return;
    setSaving(true);
    setMessage(null);
    const body: Record<string, unknown> = {
      name: form.name,
      followers: form.followers === "" ? null : Number(form.followers),
      gender: form.gender || null,
      status: form.status,
      phones: split(form.phones),
      emails: split(form.emails),
      city: form.city,
      state: form.state,
      manager: form.manager,
      tags: split(form.tags),
      notes: form.notes,
      ...(genresChanged ? { genres: form.genres } : {}),
      ...extra,
    };
    const res = await fetch(`/api/creators/${encodeURIComponent(creator.handle)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setMessage(json.error ?? "Save failed");
    setCreator(json);
    setForm(toForm(json));
    setMessage("Saved");
    onChanged();
  }

  async function remove() {
    if (!creator || !confirm(`Delete @${creator.handle} from the dashboard? This can't be undone.`)) return;
    const res = await fetch(`/api/creators/${encodeURIComponent(creator.handle)}`, { method: "DELETE" });
    if (res.ok) {
      onChanged();
      onClose();
    }
  }

  const upd = (patch: Partial<Form>) => setForm((f) => f && { ...f, ...patch });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <aside className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-line border-t-4 border-t-accent px-5 py-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">{creator?.name ?? (creator ? `@${creator.handle}` : "Loading…")}</h2>
            {creator && (
              <a href={creator.instagramUrl} target="_blank" rel="noreferrer" className="text-sm text-accent-ink hover:underline">
                @{creator.handle} · Open on Instagram ↗
              </a>
            )}
          </div>
          <button className="btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {creator && form && (
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="label !mb-0">Genre</span>
                <span className={`text-xs ${creator.genreStatus === "verified" ? "text-good" : creator.genreStatus === "needs-review" ? "text-warn" : "text-muted"}`}>
                  {GENRE_STATUS_LABEL[creator.genreStatus]}
                  {creator.genreSource ? ` · source: ${creator.genreSource}` : ""}
                </span>
              </div>
              {creator.bio && <p className="mb-2 text-xs text-ink-2">Instagram bio: “{creator.bio}”</p>}
              {creator.nicheRaw.length > 0 && (
                <p className="mb-2 text-xs text-ink-2">Creator described their niche as: “{creator.nicheRaw.join("”, “")}”</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => {
                  const on = form.genres.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => upd({ genres: on ? form.genres.filter((x) => x !== g) : [...form.genres, g] })}
                      className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2"}`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              {creator.genreStatus !== "verified" && creator.genres.length > 0 && !genresChanged && (
                <button className="mt-2 text-xs text-accent-ink hover:underline" onClick={() => save({ genreStatus: "verified" })}>
                  Mark these genres as verified
                </button>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3">
              <Field label="Name"><input className="input w-full" value={form.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
              <Field label={`Followers (${formatFollowers(creator.followers)})`}>
                <input className="input w-full" inputMode="numeric" value={form.followers} onChange={(e) => upd({ followers: e.target.value.replace(/\D/g, "") })} />
              </Field>
              <Field label="Status">
                <select className="input w-full" value={form.status} onChange={(e) => upd({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Gender">
                <select className="input w-full" value={form.gender} onChange={(e) => upd({ gender: e.target.value })}>
                  <option value="">Unknown</option>
                  <option>Female</option>
                  <option>Male</option>
                </select>
              </Field>
              <Field label="Phone numbers (comma separated)"><input className="input w-full" value={form.phones} onChange={(e) => upd({ phones: e.target.value })} /></Field>
              <Field label="Emails (comma separated)"><input className="input w-full" value={form.emails} onChange={(e) => upd({ emails: e.target.value })} /></Field>
              <Field label="City"><input className="input w-full" value={form.city} onChange={(e) => upd({ city: e.target.value })} /></Field>
              <Field label="State"><input className="input w-full" value={form.state} onChange={(e) => upd({ state: e.target.value })} /></Field>
              <Field label="Agency contact / manager"><input className="input w-full" value={form.manager} onChange={(e) => upd({ manager: e.target.value })} /></Field>
              <Field label="Tags (comma separated)"><input className="input w-full" value={form.tags} onChange={(e) => upd({ tags: e.target.value })} /></Field>
              <div className="col-span-2">
                <Field label="Notes">
                  <textarea className="input h-24 w-full py-2" value={form.notes} onChange={(e) => upd({ notes: e.target.value })} placeholder="Rates discussed, content style, past performance…" />
                </Field>
              </div>
            </section>

            {creator.address && (
              <section>
                <span className="label">Address</span>
                <p className="text-sm text-ink-2">{creator.address}{creator.pincode ? ` · ${creator.pincode}` : ""}</p>
              </section>
            )}

            <section>
              <span className="label">Lists / campaigns ({creator.lists.length})</span>
              <div className="flex flex-wrap gap-1">{creator.lists.map((l) => <span key={l} className="chip">{l}</span>)}</div>
            </section>

            {creator.details.length > 0 && (
              <section>
                <span className="label">Campaign details from the sheets</span>
                <div className="overflow-hidden rounded-md border border-line">
                  <table className="w-full text-xs">
                    <tbody>
                      {creator.details.map((d, i) => (
                        <tr key={i} className="border-t border-line first:border-t-0">
                          <td className="whitespace-nowrap px-2 py-1.5 text-muted">{d.list}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-ink-2">{d.field}</td>
                          <td className="px-2 py-1.5 break-all">
                            {/^https?:\/\//.test(d.value) ? <a className="text-accent-ink hover:underline" href={d.value} target="_blank" rel="noreferrer">link ↗</a> : d.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="text-xs text-muted">
              {creator.phones.length > 0 && <div>Phones on file: {creator.phones.map(formatPhone).join(", ")}</div>}
              <div>Found in {creator.sources.length} sheet row{creator.sources.length === 1 ? "" : "s"}: {[...new Set(creator.sources.map((s) => s.sheet))].join(", ") || "added manually"}</div>
              {creator.firstSeenAt && <div>First form response: {new Date(creator.firstSeenAt).toLocaleDateString()}</div>}
              <div>Last updated: {new Date(creator.updatedAt).toLocaleString()}</div>
            </section>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <button className="text-sm text-danger hover:underline" onClick={remove} disabled={!creator}>Delete creator</button>
          <div className="flex items-center gap-3">
            {message && <span className={`text-sm ${message === "Saved" ? "text-good" : "text-danger"}`}>{message}</span>}
            <button className="btn-primary" onClick={() => save()} disabled={saving || !form}>{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </aside>
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
