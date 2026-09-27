import type { NextRequest } from "next/server";
import { campaignsCollection, creatorsCollection, getDb } from "@/lib/mongodb";
import { campaignSummary, parseObjectId, toCampaignDTO } from "@/lib/campaignQuery";
import { DELIVERABLE_STATUSES, DELIVERABLE_TYPES, PIPELINE_STATUSES, type Deliverable } from "@/lib/types";
import { getRoleFromRequest, redactCampaignCreators } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string; handle: string }> };

function cleanDeliverables(input: unknown): Deliverable[] | null {
  if (!Array.isArray(input)) return null;
  const out: Deliverable[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const d = raw as Record<string, unknown>;
    out.push({
      id: typeof d.id === "string" && d.id ? d.id : crypto.randomUUID(),
      type: (DELIVERABLE_TYPES as readonly string[]).includes(d.type as string) ? (d.type as Deliverable["type"]) : "Other",
      dueDate: typeof d.dueDate === "string" && d.dueDate ? new Date(d.dueDate) : null,
      status: (DELIVERABLE_STATUSES as readonly string[]).includes(d.status as string) ? (d.status as Deliverable["status"]) : "Pending",
      link: typeof d.link === "string" && d.link.trim() ? d.link.trim() : null,
      notes: typeof d.notes === "string" ? d.notes : "",
    });
  }
  return out;
}

async function loadEnriched(oid: ReturnType<typeof parseObjectId>) {
  const db = await getDb();
  const doc = oid ? await campaignsCollection(db).findOne({ _id: oid }) : null;
  if (!doc) return null;
  const creators = await creatorsCollection(db).find({ handle: { $in: doc.creators.map((c) => c.handle) } }).toArray();
  return { db, doc, byHandle: new Map(creators.map((c) => [c.handle, c])) };
}

/** Update one creator's row within a campaign. Body may include status, rate, paid, notes, deliverables (full replace). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const role = await getRoleFromRequest(req);
  const { id, handle } = await params;
  const oid = parseObjectId(id);
  if (!oid) return Response.json({ error: "Invalid id" }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid body" }, { status: 400 });

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if ("status" in body) {
    if (!(PIPELINE_STATUSES as readonly string[]).includes(body.status)) return Response.json({ error: "Unknown status" }, { status: 400 });
    set["creators.$[c].status"] = body.status;
  }
  if ("rate" in body) {
    set["creators.$[c].rate"] = Number.isFinite(Number(body.rate)) && body.rate !== "" && body.rate !== null ? Number(body.rate) : null;
  }
  if ("paid" in body) set["creators.$[c].paid"] = !!body.paid;
  if ("notes" in body) set["creators.$[c].notes"] = typeof body.notes === "string" ? body.notes : "";
  if ("deliverables" in body) {
    const deliverables = cleanDeliverables(body.deliverables);
    if (deliverables === null) return Response.json({ error: "Invalid deliverables" }, { status: 400 });
    set["creators.$[c].deliverables"] = deliverables;
  }

  const db = await getDb();
  const lowerHandle = handle.toLowerCase();
  const campaign = await campaignsCollection(db).findOne({ _id: oid, "creators.handle": lowerHandle }, { projection: { _id: 1 } });
  if (!campaign) return Response.json({ error: "Not found" }, { status: 404 });

  await campaignsCollection(db).updateOne({ _id: oid }, { $set: set }, { arrayFilters: [{ "c.handle": lowerHandle }] });

  const loaded = await loadEnriched(oid);
  if (!loaded) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(
    redactCampaignCreators({ ...toCampaignDTO(loaded.doc, loaded.byHandle), summary: campaignSummary(loaded.doc, loaded.byHandle) }, role),
  );
}

/** Remove a creator from a campaign (does not delete the creator itself). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, handle } = await params;
  const oid = parseObjectId(id);
  if (!oid) return Response.json({ error: "Invalid id" }, { status: 400 });
  const db = await getDb();
  const res = await campaignsCollection(db).updateOne(
    { _id: oid },
    { $pull: { creators: { handle: handle.toLowerCase() } }, $set: { updatedAt: new Date() } },
  );
  return res.matchedCount ? new Response(null, { status: 204 }) : Response.json({ error: "Not found" }, { status: 404 });
}
