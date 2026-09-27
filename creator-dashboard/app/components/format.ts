export function formatFollowers(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export function formatPhone(p: string): string {
  return p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p;
}

export const FOLLOWER_TIERS = [
  { key: "", label: "Any size", min: 0, max: 0 },
  { key: "under1k", label: "Under 1K", min: 0, max: 1_000 },
  { key: "nano", label: "Nano · 1K–10K", min: 1_000, max: 10_000 },
  { key: "micro", label: "Micro · 10K–100K", min: 10_000, max: 100_000 },
  { key: "macro", label: "Macro · 100K–1M", min: 100_000, max: 1_000_000 },
  { key: "mega", label: "Mega · 1M+", min: 1_000_000, max: 0 },
];

export const GENRE_STATUS_LABEL: Record<string, string> = {
  untagged: "Not tagged",
  auto: "From sheets",
  "needs-review": "Needs review",
  verified: "Verified",
};
