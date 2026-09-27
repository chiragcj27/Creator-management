import type { Creator } from "./types";

export function newCreator(handle: string): Creator {
  const now = new Date();
  return {
    handle,
    name: null,
    instagramUrl: `https://www.instagram.com/${handle}/`,
    followers: null,
    gender: null,
    phones: [],
    emails: [],
    address: null,
    city: null,
    state: null,
    pincode: null,
    genres: [],
    genreStatus: "untagged",
    genreSource: null,
    nicheRaw: [],
    tags: [],
    lists: [],
    manager: null,
    avgViews: null,
    status: "New",
    notes: "",
    details: [],
    sources: [],
    firstSeenAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

const union = <T>(a: T[] = [], b: T[] = []) => {
  const seen = new Map<string, T>();
  for (const x of [...a, ...b]) seen.set(typeof x === "string" ? x : JSON.stringify(x), x);
  return [...seen.values()];
};

const maxOrNull = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/**
 * Merges newly imported data into an existing creator. Existing values win for single fields
 * (so manual edits survive re-imports); lists are combined; followers keep the highest count seen.
 * Genres marked "verified" are never touched by an import.
 */
export function mergeCreators(base: Creator, inc: Creator, opts: { preferFullerName?: boolean } = {}): Creator {
  let name = base.name ?? inc.name;
  if (opts.preferFullerName && base.name && inc.name && inc.name.split(" ").length > base.name.split(" ").length) name = inc.name;

  const verified = base.genreStatus === "verified";
  const genres = verified ? base.genres : union(base.genres, inc.genres);
  const genreStatus = verified
    ? "verified"
    : genres.length
      ? "auto"
      : base.genreStatus === "needs-review" || inc.genreStatus === "needs-review"
        ? "needs-review"
        : "untagged";

  const firstSeen = [base.firstSeenAt, inc.firstSeenAt].filter((d): d is Date => !!d).sort((a, b) => +a - +b)[0] ?? null;

  return {
    ...base,
    name,
    followers: maxOrNull(base.followers, inc.followers),
    gender: base.gender ?? inc.gender,
    phones: union(base.phones, inc.phones),
    emails: union(base.emails, inc.emails),
    address: base.address ?? inc.address,
    city: base.city ?? inc.city,
    state: base.state ?? inc.state,
    pincode: base.pincode ?? inc.pincode,
    genres,
    genreStatus,
    genreSource: verified ? base.genreSource : (base.genreSource ?? inc.genreSource),
    nicheRaw: union(base.nicheRaw, inc.nicheRaw),
    tags: union(base.tags, inc.tags),
    lists: union(base.lists, inc.lists),
    manager: base.manager ?? inc.manager,
    avgViews: maxOrNull(base.avgViews, inc.avgViews),
    details: union(base.details, inc.details),
    sources: union(base.sources, inc.sources),
    firstSeenAt: firstSeen,
  };
}
