"use client";

import { useState } from "react";
import { useRole } from "@/lib/RoleContext";

export default function AddCreatorDialog({ genres, onClose, onAdded }: { genres: string[]; onClose: () => void; onAdded: (handle: string) => void }) {
  const canSeeContacts = useRole() === "admin";
  const [f, setF] = useState({ instagram: "", name: "", followers: "", phone: "", email: "", city: "", gender: "", notes: "" });
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, genres: picked }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.status === 409) return onAdded(json.handle); // already exists: open it instead
    if (!res.ok) return setError(json.error ?? "Could not add creator");
    onAdded(json.handle);
  }

  const input = (key: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input w-full" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} {...props} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-line border-t-4 border-t-accent bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Add a <span className="font-serif font-normal italic text-accent">creator</span></h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">{input("instagram", "Instagram link or @handle *", { required: true, placeholder: "https://www.instagram.com/…", autoFocus: true })}</div>
          {input("name", "Name")}
          {input("followers", "Followers", { placeholder: "e.g. 25K" })}
          {canSeeContacts && input("phone", "Phone")}
          {canSeeContacts && input("email", "Email", { type: "email" })}
          {input("city", "City")}
          <label className="block">
            <span className="label">Gender</span>
            <select className="input w-full" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
              <option value="">Unknown</option>
              <option>Female</option>
              <option>Male</option>
            </select>
          </label>
          <div className="col-span-2">
            <span className="label">Genre (leave empty if you don&apos;t know yet)</span>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => {
                const on = picked.includes(g);
                return (
                  <button type="button" key={g} onClick={() => setPicked(on ? picked.filter((x) => x !== g) : [...picked, g])}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2"}`}>
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="col-span-2">
            <span className="label">Notes</span>
            <textarea className="input h-20 w-full py-2" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Adding…" : "Add creator"}</button>
        </div>
      </form>
    </div>
  );
}
