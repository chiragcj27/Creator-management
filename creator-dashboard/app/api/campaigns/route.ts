import type { NextRequest } from "next/server";
import { campaignsCollection, creatorsCollection, getDb } from "@/lib/mongodb";
import { buildCampaignFilter, campaignSummary, cleanStringArray, toCampaignDTO } from "@/lib/campaignQuery";
import { newCampaign } from "@/lib/campaign";
import { CAMPAIGN_STATUSES } from "@/lib/types";
import { getRoleFromRequest, redactCampaignCreators } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const role = await getRoleFromRequest(req);
  const params = req.nextUrl.searchParams;
  const db = await getDb();
  const docs = await campaignsCollection(db).find(buildCampaignFilter(params)).sort({ updatedAt: -1 }).toArray();

  const handles = [...new Set(docs.flatMap((d) => d.creators.map((c) => c.handle)))];
  const creators = handles.length ? await creatorsCollection(db).find({ handle: { $in: handles } }).toArray() : [];
  const byHandle = new Map(creators.map((c) => [c.handle, c]));

  const items = docs.map((d) => redactCampaignCreators({ ...toCampaignDTO(d, byHandle), summary: campaignSummary(d, byHandle) }, role));
  return Response.json({ items, total: items.length });
}

/** Create a campaign. Body: { name, brand?, description?, status?, startDate?, endDate?, budget?, platforms?, targetGenres?, notes? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "Campaign name is required." }, { status: 400 });

  const c = newCampaign(name);
  c.brand = typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : null;
  c.description = typeof body.description === "string" ? body.description : "";
  if (CAMPAIGN_STATUSES.includes(body.status)) c.status = body.status;
  c.startDate = body.startDate ? new Date(body.startDate) : null;
  c.endDate = body.endDate ? new Date(body.endDate) : null;
  c.budget = Number.isFinite(Number(body.budget)) && body.budget !== "" && body.budget !== null ? Number(body.budget) : null;
  c.platforms = cleanStringArray(body.platforms);
  c.targetGenres = cleanStringArray(body.targetGenres);
  c.notes = typeof body.notes === "string" ? body.notes : "";

  const res = await campaignsCollection(await getDb()).insertOne(c);
  return Response.json({ ...toCampaignDTO({ ...c, _id: res.insertedId }), summary: campaignSummary(c) }, { status: 201 });
}
