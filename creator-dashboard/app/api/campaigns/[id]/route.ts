import type { NextRequest } from "next/server";
import { campaignsCollection, creatorsCollection, getDb } from "@/lib/mongodb";
import { campaignSummary, cleanStringArray, parseObjectId, toCampaignDTO } from "@/lib/campaignQuery";
import { CAMPAIGN_STATUSES, type Campaign } from "@/lib/types";
import { getRoleFromRequest, redactCampaignCreators } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

async function loadEnriched(id: string) {
  const oid = parseObjectId(id);
  if (!oid) return null;
  const db = await getDb();
  const doc = await campaignsCollection(db).findOne({ _id: oid });
  if (!doc) return null;
  const handles = doc.creators.map((c) => c.handle);
  const creators = handles.length ? await creatorsCollection(db).find({ handle: { $in: handles } }).toArray() : [];
  return { doc, byHandle: new Map(creators.map((c) => [c.handle, c])) };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const role = await getRoleFromRequest(req);
  const { id } = await params;
  const loaded = await loadEnriched(id);
  if (!loaded) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(
    redactCampaignCreators({ ...toCampaignDTO(loaded.doc, loaded.byHandle), summary: campaignSummary(loaded.doc, loaded.byHandle) }, role),
  );
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Update a campaign's own fields (not its creators — see /creators/[handle] for that). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const role = await getRoleFromRequest(req);
  const { id } = await params;
  const oid = parseObjectId(id);
  if (!oid) return Response.json({ error: "Invalid id" }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid body" }, { status: 400 });

  const set: Partial<Campaign> = {};
  if ("name" in body) {
    const name = str(body.name);
    if (!name) return Response.json({ error: "Campaign name is required." }, { status: 400 });
    set.name = name;
  }
  if ("brand" in body) set.brand = str(body.brand);
  if ("description" in body) set.description = typeof body.description === "string" ? body.description : "";
  if ("notes" in body) set.notes = typeof body.notes === "string" ? body.notes : "";
  if ("status" in body) {
    if (!CAMPAIGN_STATUSES.includes(body.status)) return Response.json({ error: "Unknown status" }, { status: 400 });
    set.status = body.status;
  }
  if ("startDate" in body) set.startDate = body.startDate ? new Date(body.startDate) : null;
  if ("endDate" in body) set.endDate = body.endDate ? new Date(body.endDate) : null;
  if ("budget" in body) set.budget = Number.isFinite(Number(body.budget)) && body.budget !== "" && body.budget !== null ? Number(body.budget) : null;
  if ("platforms" in body) set.platforms = cleanStringArray(body.platforms);
  if ("targetGenres" in body) set.targetGenres = cleanStringArray(body.targetGenres);

  const db = await getDb();
  const before = await campaignsCollection(db).findOne({ _id: oid }, { projection: { name: 1 } });
  if (!before) return Response.json({ error: "Not found" }, { status: 404 });
  await campaignsCollection(db).updateOne({ _id: oid }, { $set: { ...set, updatedAt: new Date() } });

  // Keep a creator's "lists" chip in sync if the campaign was renamed.
  if (set.name && set.name !== before.name) {
    await creatorsCollection(db).updateMany({ lists: before.name }, { $set: { "lists.$[l]": set.name } }, { arrayFilters: [{ l: before.name }] });
  }

  const loaded = await loadEnriched(id);
  if (!loaded) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(
    redactCampaignCreators({ ...toCampaignDTO(loaded.doc, loaded.byHandle), summary: campaignSummary(loaded.doc, loaded.byHandle) }, role),
  );
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const oid = parseObjectId(id);
  if (!oid) return Response.json({ error: "Invalid id" }, { status: 400 });
  const db = await getDb();
  const doc = await campaignsCollection(db).findOne({ _id: oid }, { projection: { name: 1 } });
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  await campaignsCollection(db).deleteOne({ _id: oid });
  await creatorsCollection(db).updateMany({ lists: doc.name }, { $pull: { lists: doc.name } });
  return new Response(null, { status: 204 });
}
