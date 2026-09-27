import type { Filter } from "mongodb";
import { ObjectId } from "mongodb";
import type {
  Campaign,
  CampaignCreator,
  CampaignCreatorDTO,
  CampaignDTO,
  CampaignSummary,
  Creator,
  Deliverable,
  DeliverableDTO,
} from "./types";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Builds a MongoDB filter from the campaigns page's URL query parameters. */
export function buildCampaignFilter(params: URLSearchParams): Filter<Campaign> {
  const and: Filter<Campaign>[] = [];
  const q = params.get("q")?.trim();
  if (q) {
    const re = new RegExp(escapeRe(q), "i");
    and.push({ $or: [{ name: re }, { brand: re }] });
  }
  const status = params.get("status");
  if (status) and.push({ status: status as Campaign["status"] });
  return and.length ? { $and: and } : {};
}

export const parseObjectId = (id: string): ObjectId | null => (ObjectId.isValid(id) ? new ObjectId(id) : null);

/** Dedupes and trims a JSON array of strings, dropping anything that isn't a non-empty string. */
export function cleanStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<string>();
  for (const x of v) if (typeof x === "string" && x.trim()) out.add(x.trim());
  return [...out];
}

const toDeliverableDTO = (d: Deliverable): DeliverableDTO => ({
  ...d,
  dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : null,
});

export function toCampaignCreatorDTO(cc: CampaignCreator, creator?: Creator | null): CampaignCreatorDTO {
  return {
    ...cc,
    deliverables: cc.deliverables.map(toDeliverableDTO),
    addedAt: new Date(cc.addedAt).toISOString(),
    name: creator?.name ?? null,
    instagramUrl: creator?.instagramUrl ?? `https://www.instagram.com/${cc.handle}/`,
    followers: creator?.followers ?? null,
    genres: creator?.genres ?? [],
    city: creator?.city ?? null,
    phones: creator?.phones ?? [],
    emails: creator?.emails ?? [],
    missing: !creator,
  };
}

export function toCampaignDTO(doc: Campaign & { _id: unknown }, creatorsByHandle?: Map<string, Creator>): CampaignDTO {
  return {
    ...doc,
    _id: String(doc._id),
    startDate: doc.startDate ? new Date(doc.startDate).toISOString() : null,
    endDate: doc.endDate ? new Date(doc.endDate).toISOString() : null,
    creators: doc.creators.map((cc) => toCampaignCreatorDTO(cc, creatorsByHandle?.get(cc.handle))),
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

/** Pipeline breakdown, estimated reach and spend for a campaign. Reach only counts creators still on the roster. */
export function campaignSummary(doc: Pick<Campaign, "creators">, creatorsByHandle?: Map<string, Creator>): CampaignSummary {
  const byStatus: Record<string, number> = {};
  let totalReach = 0;
  let agreedSpend = 0;
  let paidSpend = 0;
  for (const c of doc.creators) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    if (c.status !== "Dropped") {
      totalReach += creatorsByHandle?.get(c.handle)?.followers ?? 0;
      if (c.rate) agreedSpend += c.rate;
    }
    if (c.paid && c.rate) paidSpend += c.rate;
  }
  return { creatorCount: doc.creators.length, byStatus, totalReach, agreedSpend, paidSpend };
}
