"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import type { CreatorDTO } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import { FOLLOWER_TIERS, GENRE_STATUS_LABEL, formatFollowers, formatPhone } from "./format";
import CreatorDrawer from "./CreatorDrawer";
import AddCreatorDialog from "./AddCreatorDialog";
import ImportDialog from "./ImportDialog";
import TopNav from "./TopNav";
import { useRole } from "@/lib/RoleContext";

type Count = { value: string; count: number };
export interface Meta {
  total: number;
  withPhone: number;
  withEmail: number;
  genreStatus: Record<string, number>;
  genres: Count[];
  allGenres: string[];
  lists: Count[];
  tags: Count[];
  statuses: Count[];
  cities: Count[];
  states: Count[];
  lastImport: { file: string; importedAt: string } | null;
}

const FILTER_KEYS = ["q", "genre", "list", "tag", "status", "genreStatus", "gender", "city", "tier", "hasPhone", "hasEmail", "sort", "dir", "page", "creator"] as const;
const NOT_FILTERS = new Set(["sort", "dir", "page", "creator"]);
type Filters = Partial<Record<(typeof FILTER_KEYS)[number], string>>;

function readFilters(p: URLSearchParams): Filters {
  return Object.fromEntries(FILTER_KEYS.filter((k) => p.get(k)).map((k) => [k, p.get(k)!]));
}

type ListData = { key: string; items: CreatorDTO[]; total: number; page: number; pageSize: number };

function toParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (f[k] && k !== "tier" && k !== "creator") p.set(k, f[k]!);
  const tier = FOLLOWER_TIERS.find((t) => t.key === f.tier);
  if (tier?.key) {
    if (tier.min) p.set("minFollowers", String(tier.min));
    if (tier.max) p.set("maxFollowers", String(tier.max));
  }
  return p;
}

const getJson = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
};

export default function Dashboard() {
  const canSeeContacts = useRole() === "admin";
  // The URL is the source of truth for filters, so a filtered view can be bookmarked or shared.
  const searchParams = useSearchParams();
  const router = useRouter();
  const filters = useMemo(() => readFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const apiQuery = toParams(filters).toString();

  const [search, setSearch] = useState(filters.q ?? "");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [data, setData] = useState<ListData | null>(null);
  const [version, setVersion] = useState(0); // bump to refetch after edits/imports
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const setFilters = useCallback(
    (next: Filters) => {
      const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router],
  );
  const set = (patch: Filters) => setFilters({ ...filters, ...patch, page: patch.page ?? undefined });
  // The open creator lives in the URL too, so a link can point straight at one creator.
  const openHandle = filters.creator ?? null;
  const setOpenHandle = (h: string | null) => setFilters({ ...filters, creator: h ?? undefined });

  useEffect(() => {
    let alive = true;
    getJson("/api/meta")
      .then((m) => alive && setMeta(m))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [version]);

  useEffect(() => {
    let alive = true;
    const key = `${apiQuery}#${version}`;
    getJson(`/api/creators?${apiQuery}`)
      .then((d) => {
        if (!alive) return;
        setData({ ...d, key });
        setError(null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [apiQuery, version]);
  const loading = data?.key !== `${apiQuery}#${version}`;

  // Debounced search box
  useEffect(() => {
    if ((filters.q ?? "") === search) return;
    const t = setTimeout(() => setFilters({ ...filters, q: search || undefined, page: undefined }), 300);
    return () => clearTimeout(t);
  }, [search, filters, setFilters]);

  const refreshAll = () => setVersion((v) => v + 1);

  const sortBy = (field: string) => {
    const same = (filters.sort ?? "followers") === field;
    const dir = same ? (filters.dir === "asc" ? "desc" : "asc") : field === "followers" ? "desc" : "asc";
    set({ sort: field, dir });
  };

  const activeFilterCount = FILTER_KEYS.filter((k) => !NOT_FILTERS.has(k) && filters[k]).length;
  const tagged = (meta?.genreStatus.auto ?? 0) + (meta?.genreStatus.verified ?? 0);
  const toCheck = (meta?.genreStatus.untagged ?? 0) + (meta?.genreStatus["needs-review"] ?? 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const page = data?.page ?? 1;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="relative mb-5 overflow-hidden rounded-3xl bg-hero text-hero-ink">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-accent/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 px-6 pb-7 pt-5 sm:px-8">
          <div>
            <Image src="/logo-wordmark.png" alt="The Branding Hauz" width={970} height={366} priority className="h-11 w-auto sm:h-14" />
            <h1 className="mt-7font-display text-5xl font-extrabold leading-none tracking-tight sm:text-7xl">
              Creator <span className="font-serif font-normal italic text-accent">Hub</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-hero-ink/60">
              {meta?.lastImport
                ? `Last import: ${meta.lastImport.file} · ${new Date(meta.lastImport.importedAt).toLocaleDateString()}`
                : "The talent roster behind every Branding Hauz campaign."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TopNav />
            <a className="btn-ghost" href={`/api/export?${toParams(filters)}`}>
              Export CSV{activeFilterCount ? " (filtered)" : ""}
            </a>
            <button className="btn-ghost" onClick={() => setShowImport(true)}>Import Excel</button>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add creator</button>
          </div>
        </div>
        {meta && meta.genres.length > 0 && <GenreTicker genres={meta.genres.slice(0, 14).map((g) => g.value)} />}
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Creators" value={meta?.total} tone="accent" sub="On the roster" />
        <Stat label="Genre tagged" value={tagged} sub={meta?.total ? `${Math.round((tagged / meta.total) * 100)}% of all` : undefined}
          progress={meta?.total ? tagged / meta.total : undefined} />
        <Stat label="With phone number" value={meta?.withPhone} sub={meta ? `${meta.withEmail.toLocaleString()} with email` : undefined} />
        <Stat
          label="Genre still to check"
          value={toCheck}
          onClick={() => set({ genreStatus: "untagged,needs-review", genre: undefined })}
          sub="Click to list them →"
        />
      </section>

      {meta && meta.genres.length > 0 && (
        <GenreBreakdown meta={meta} active={filters.genre} onPick={(g) => set({ genre: filters.genre === g ? undefined : g })} />
      )}

      <section className="sticky top-2 z-20 mb-3 rounded-2xl border border-line bg-surface/85 p-3 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-full sm:w-64"
            placeholder="Search name, @handle, phone, email, city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={filters.genre} onChange={(v) => set({ genre: v })} placeholder="All genres"
            options={[{ value: "__none", label: "No genre yet" }, ...(meta?.allGenres ?? []).map((g) => ({ value: g, label: g }))]} />
          <Select value={filters.list} onChange={(v) => set({ list: v })} placeholder="All lists / campaigns"
            options={(meta?.lists ?? []).map((l) => ({ value: l.value, label: `${l.value} (${l.count})` }))} />
          <Select value={filters.tier} onChange={(v) => set({ tier: v })} placeholder="Any size"
            options={FOLLOWER_TIERS.filter((t) => t.key).map((t) => ({ value: t.key, label: t.label }))} />
          <Select value={filters.status} onChange={(v) => set({ status: v })} placeholder="Any status"
            options={STATUSES.map((s) => ({ value: s, label: s }))} />
          <Select value={filters.city} onChange={(v) => set({ city: v })} placeholder="All cities"
            options={(meta?.cities ?? []).map((c) => ({ value: c.value, label: `${c.value} (${c.count})` }))} />
          <Select value={filters.gender} onChange={(v) => set({ gender: v })} placeholder="Any gender"
            options={[{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }, { value: "__none", label: "Unknown" }]} />
          <Select value={filters.genreStatus} onChange={(v) => set({ genreStatus: v })} placeholder="Any genre status"
            options={[...Object.entries(GENRE_STATUS_LABEL).map(([value, label]) => ({ value, label })), { value: "untagged,needs-review", label: "Still to check" }]} />
          {(meta?.tags.length ?? 0) > 0 && (
            <Select value={filters.tag} onChange={(v) => set({ tag: v })} placeholder="Any tag"
              options={(meta?.tags ?? []).map((t) => ({ value: t.value, label: `${t.value} (${t.count})` }))} />
          )}
          <Toggle label="Has phone" on={filters.hasPhone === "1"} onChange={(on) => set({ hasPhone: on ? "1" : undefined })} />
          <Toggle label="Has email" on={filters.hasEmail === "1"} onChange={(on) => set({ hasEmail: on ? "1" : undefined })} />
          {activeFilterCount > 0 && (
            <button className="text-sm text-accent-ink hover:underline" onClick={() => { setSearch(""); setFilters({ sort: filters.sort, dir: filters.dir }); }}>
              Clear filters
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm text-ink-2">
          <span className="flex items-baseline gap-2">
            {data ? (
              <>
                <span className="font-display text-lg font-bold text-ink tabular-nums">{data.total.toLocaleString()}</span>
                creator{data.total === 1 ? "" : "s"}
              </>
            ) : "Loading…"}
            {loading && data ? <span className="text-accent-ink">· updating…</span> : ""}
          </span>
          <span className="text-muted">Click a row to view or edit</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <Th label="Creator" field="name" filters={filters} onSort={sortBy} />
                <th className="px-4 py-2 font-medium">Genre</th>
                <Th label="Followers" field="followers" filters={filters} onSort={sortBy} align="right" />
                {canSeeContacts && <th className="px-4 py-2 font-medium">Contact</th>}
                <Th label="City" field="city" filters={filters} onSort={sortBy} />
                <th className="px-4 py-2 font-medium">Lists / campaigns</th>
                <Th label="Status" field="status" filters={filters} onSort={sortBy} />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((c) => (
                <tr key={c.handle} className="group cursor-pointer border-t border-line transition-colors hover:bg-accent-soft/40" onClick={() => setOpenHandle(c.handle)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name ?? c.handle} seed={c.handle} />
                      <div className="min-w-0">
                        <div className="font-medium group-hover:text-accent-ink">{c.name ?? <span className="text-muted">No name</span>}</div>
                        <a href={c.instagramUrl} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-accent-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                          @{c.handle}
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {c.genres.length ? c.genres.slice(0, 3).map((g) => <span key={g} className="chip">{g}</span>) : (
                        <span className={`text-xs ${c.genreStatus === "needs-review" ? "text-warn" : "text-muted"}`}>
                          {GENRE_STATUS_LABEL[c.genreStatus]}
                        </span>
                      )}
                      {c.genres.length > 3 && <span className="chip">+{c.genres.length - 3}</span>}
                      {c.genreStatus === "verified" && <span title="Verified" className="text-xs text-good">✓</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-display text-base font-semibold tabular-nums">{formatFollowers(c.followers)}</td>
                  {canSeeContacts && (
                    <td className="px-4 py-2.5 text-xs text-ink-2">
                      {c.phones[0] ? <div className="tabular-nums">{formatPhone(c.phones[0])}</div> : null}
                      {c.emails[0] ? <div className="max-w-[200px] truncate">{c.emails[0]}</div> : null}
                      {!c.phones.length && !c.emails.length && <span className="text-muted">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-ink-2">{c.city ?? <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex max-w-[240px] flex-wrap gap-1">
                      {c.lists.slice(0, 2).map((l) => <span key={l} className="chip">{l}</span>)}
                      {c.lists.length > 2 && <span className="chip" title={c.lists.slice(2).join(", ")}>+{c.lists.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect creator={c} onSaved={(u) => setData((d) => d && { ...d, items: d.items.map((x) => (x.handle === u.handle ? u : x)) })} />
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={canSeeContacts ? 7 : 6} className="px-4 py-16 text-center text-muted">
                    <div className="font-serif text-3xl italic text-ink-2">Nothing here yet.</div>
                    <div className="mt-1">{meta?.total === 0 ? "Use Import Excel to load your sheets." : "No creators match these filters."}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm text-ink-2">
            <span>
              {((page - 1) * data.pageSize + 1).toLocaleString()}–{Math.min(page * data.pageSize, data.total).toLocaleString()} of {data.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button className="btn" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Previous</button>
              <button className="btn" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>Next</button>
            </div>
          </div>
        )}
      </section>

      {openHandle && (
        <CreatorDrawer
          handle={openHandle}
          genres={meta?.allGenres ?? []}
          onClose={() => setOpenHandle(null)}
          onChanged={refreshAll}
        />
      )}
      {showAdd && meta && (
        <AddCreatorDialog genres={meta.allGenres} onClose={() => setShowAdd(false)} onAdded={(h) => { setShowAdd(false); refreshAll(); setOpenHandle(h); }} />
      )}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImported={refreshAll} />}
    </div>
  );
}

/** Scrolling strip of the top genres along the bottom of the hero. */
function GenreTicker({ genres }: { genres: string[] }) {
  const run = genres.flatMap((g) => [g, "✺"]);
  return (
    <div className="relative overflow-hidden bg-accent py-2 text-white">
      <div className="marquee flex w-max gap-6 whitespace-nowrap font-display text-sm font-bold uppercase tracking-wider">
        {[...run, ...run].map((g, i) => (
          <span key={i} className={g === "✺" ? "opacity-70" : ""}>{g}</span>
        ))}
      </div>
    </div>
  );
}

const AVATAR_TONES = [
  "bg-[#ff4a1c] text-white",
  "bg-[#151311] text-[#f3efe6] dark:bg-[#f3efe6] dark:text-[#151311]",
  "bg-[#ffb199] text-[#5a1a06]",
  "bg-[#e9e1cf] text-[#4d4740]",
  "bg-[#ffd166] text-[#4a3500]",
];

function Avatar({ name, seed }: { name: string; seed: string }) {
  const initials = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-xs font-bold ${AVATAR_TONES[h % AVATAR_TONES.length]}`}>
      {initials}
    </span>
  );
}

function Stat({ label, value, sub, onClick, tone, progress }: { label: string; value?: number; sub?: string; onClick?: () => void; tone?: "accent"; progress?: number }) {
  const Comp = onClick ? "button" : "div";
  const accent = tone === "accent";
  return (
    <Comp
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border px-5 py-4 text-left transition ${
        accent ? "border-accent bg-accent text-white" : "border-line bg-surface"
      } ${onClick ? "hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_12px_30px_-18px_var(--accent)]" : ""}`}
    >
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${accent ? "text-white/80" : "text-muted"}`}>{label}</div>
      <div className="mt-2 font-display text-4xl font-extrabold leading-none tracking-tight tabular-nums">
        {value === undefined ? "—" : value.toLocaleString()}
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-bar-track">
          <div className="h-1.5 rounded-full bg-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {sub && <div className={`mt-2 text-xs ${accent ? "text-white/80" : onClick ? "text-accent-ink" : "text-muted"}`}>{sub}</div>}
    </Comp>
  );
}

/** Single-hue horizontal bars: how many creators carry each genre. Click a bar to filter. */
function GenreBreakdown({ meta, active, onPick }: { meta: Meta; active?: string; onPick: (g: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const rows = meta.genres;
  const untagged = meta.genres.length ? meta.total - (meta.genreStatus.auto ?? 0) - (meta.genreStatus.verified ?? 0) : 0;
  const max = Math.max(...rows.map((r) => r.count), 1);
  const shown = expanded ? rows : rows.slice(0, 12);

  return (
    <section className="mb-4 rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Creators by <span className="font-serif font-normal italic text-accent">genre</span>
        </h2>
        <span className="text-xs text-muted">A creator can have more than one genre · click a bar to filter</span>
      </div>
      <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => (
          <button
            key={r.value}
            onClick={() => onPick(r.value)}
            title={`${r.value}: ${r.count.toLocaleString()} creators`}
            className={`group grid grid-cols-[110px_1fr_48px] items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-surface-2 ${active === r.value ? "bg-accent-soft" : ""}`}
          >
            <span className="truncate text-ink-2 group-hover:text-ink">{r.value}</span>
            <span className="h-2.5 rounded-full bg-bar-track">
              <span className="block h-2.5 rounded-full bg-bar transition-[width] duration-500" style={{ width: `${Math.max(2, (r.count / max) * 100)}%` }} />
            </span>
            <span className="text-right tabular-nums text-ink-2">{r.count.toLocaleString()}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        {rows.length > 12 && (
          <button className="text-accent-ink hover:underline" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Show fewer" : `Show all ${rows.length} genres`}
          </button>
        )}
        {untagged > 0 && (
          <button className={`hover:underline ${active === "__none" ? "text-accent-ink" : "text-muted"}`} onClick={() => onPick("__none")}>
            {untagged.toLocaleString()} creators have no genre yet →
          </button>
        )}
      </div>
    </section>
  );
}

function Select({ value, onChange, options, placeholder }: { value?: string; onChange: (v?: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <select className={`input max-w-[200px] pr-7 ${value ? "border-accent text-accent-ink" : ""}`} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`h-9 rounded-full border px-3.5 text-sm transition-colors ${on ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink-2 hover:border-ink"}`}
      aria-pressed={on}
    >
      {label}
    </button>
  );
}

function Th({ label, field, filters, onSort, align }: { label: string; field: string; filters: Filters; onSort: (f: string) => void; align?: "right" }) {
  const current = (filters.sort ?? "followers") === field;
  const dir = current ? (filters.dir === "asc" ? "↑" : "↓") : "";
  return (
    <th className={`whitespace-nowrap px-4 py-2 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button className={`uppercase tracking-wide hover:text-ink ${current ? "text-ink" : ""}`} onClick={() => onSort(field)}>
        {label} {dir}
      </button>
    </th>
  );
}

const STATUS_TONE: Record<string, string> = {
  New: "border-line bg-surface-2 text-ink-2",
  Contacted: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "In talks": "border-amber-500/40 bg-amber-400/15 text-amber-700 dark:text-amber-300",
  Onboarded: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Do not contact": "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

function StatusSelect({ creator, onSaved }: { creator: CreatorDTO; onSaved: (c: CreatorDTO) => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <select
      className={`h-7 cursor-pointer rounded-full border px-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/30 ${STATUS_TONE[creator.status] ?? STATUS_TONE.New}`}
      value={creator.status}
      disabled={saving}
      onChange={async (e) => {
        setSaving(true);
        const res = await fetch(`/api/creators/${encodeURIComponent(creator.handle)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: e.target.value }),
        });
        setSaving(false);
        if (res.ok) onSaved(await res.json());
      }}
    >
      {STATUSES.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
}
