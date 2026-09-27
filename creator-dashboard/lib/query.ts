import type { Filter, Sort } from "mongodb";
import type { Creator, CreatorDTO } from "./types";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const csv = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

/** Builds a MongoDB filter from the dashboard's URL query parameters. */
export function buildFilter(params: URLSearchParams): Filter<Creator> {
  const and: Filter<Creator>[] = [];

  const q = params.get("q")?.trim();
  if (q) {
    const re = new RegExp(escapeRe(q.replace(/^@/, "")), "i");
    const or: Filter<Creator>[] = [{ handle: re }, { name: re }, { emails: re }, { city: re }];
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 4) or.push({ phones: new RegExp(digits) });
    and.push({ $or: or });
  }

  const genres = csv(params.get("genre"));
  if (genres.includes("__none")) and.push({ genres: { $size: 0 } });
  else if (genres.length) and.push({ genres: { $in: genres } });

  const lists = csv(params.get("list"));
  if (lists.length) and.push({ lists: { $in: lists } });
  const tags = csv(params.get("tag"));
  if (tags.length) and.push({ tags: { $in: tags } });
  const statuses = csv(params.get("status"));
  if (statuses.length) and.push({ status: { $in: statuses as Creator["status"][] } });
  const genreStatus = csv(params.get("genreStatus"));
  if (genreStatus.length) and.push({ genreStatus: { $in: genreStatus as Creator["genreStatus"][] } });

  const gender = params.get("gender");
  if (gender === "Male" || gender === "Female") and.push({ gender });
  else if (gender === "__none") and.push({ gender: null });

  const city = params.get("city");
  if (city) and.push({ city });
  const state = params.get("state");
  if (state) and.push({ state });

  const min = Number(params.get("minFollowers"));
  const max = Number(params.get("maxFollowers"));
  if (min > 0 || max > 0) {
    const range: { $gte?: number; $lt?: number } = {};
    if (min > 0) range.$gte = min;
    if (max > 0) range.$lt = max;
    and.push({ followers: range });
  }

  if (params.get("hasPhone") === "1") and.push({ "phones.0": { $exists: true } });
  if (params.get("hasEmail") === "1") and.push({ "emails.0": { $exists: true } });

  return and.length ? { $and: and } : {};
}

const SORTABLE = new Set(["name", "handle", "followers", "city", "createdAt", "updatedAt", "status"]);

export function buildSort(params: URLSearchParams): Sort {
  const field = SORTABLE.has(params.get("sort") ?? "") ? params.get("sort")! : "followers";
  const dir = params.get("dir") === "asc" ? 1 : -1;
  return { [field]: dir, handle: 1 };
}

export function toDTO(doc: Creator & { _id: unknown }): CreatorDTO {
  return {
    ...doc,
    _id: String(doc._id),
    firstSeenAt: doc.firstSeenAt ? new Date(doc.firstSeenAt).toISOString() : null,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}
