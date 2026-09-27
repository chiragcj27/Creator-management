import type { NextRequest } from "next/server";
import { campaignsCollection, creatorsCollection, getDb } from "@/lib/mongodb";
import { campaignSummary, cleanStringArray, parseObjectId, toCampaignDTO } from "@/lib/campaignQuery";
import { newCampaignCreator } from "@/lib/campaign";
import { getRoleFromRequest, redactCampaignCreators } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** Add creators from the roster to a campaign. Body: { handles: string[] }. Already-added handles are ignored. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const role = await getRoleFromRequest(req);
  const { id } = await params;
  const oid = parseObjectId(id);
  if (!oid) return Response.json({ error: "Invalid id" }, { status: 400 });
  const body = await req.json().catch(() => null);
  const handles = cleanStringArray(body?.handles).map((h) => h.toLowerCase());
  if (!handles.length) return Response.json({ error: "No creators selected." }, { status: 400 });

  const db = await getDb();
  const campaign = await campaignsCollection(db).findOne({ _id: oid }, { projection: { name: 1, creators: 1 } });
  if (!campaign) return Response.json({ error: "Not found" }, { status: 404 });

  const existing = new Set(campaign.creators.map((c) => c.handle));
  const toAdd = handles.filter((h) => !existing.has(h));
  if (toAdd.length) {
    await campaignsCollection(db).updateOne(
      { _id: oid },
      { $push: { creators: { $each: toAdd.map(newCampaignCreator) } }, $set: { updatedAt: new Date() } },
    );
    await creatorsCollection(db).updateMany({ handle: { $in: toAdd } }, { $addToSet: { lists: campaign.name } });
  }

  const doc = await campaignsCollection(db).findOne({ _id: oid });
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  const creators = await creatorsCollection(db).find({ handle: { $in: doc.creators.map((c) => c.handle) } }).toArray();
  const byHandle = new Map(creators.map((c) => [c.handle, c]));
  return Response.json(redactCampaignCreators({ ...toCampaignDTO(doc, byHandle), summary: campaignSummary(doc, byHandle) }, role), { status: 201 });
}
