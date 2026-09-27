import type { NextRequest } from "next/server";
import { campaignsCollection, creatorsCollection, getDb } from "@/lib/mongodb";
import { parseObjectId, toCampaignDTO } from "@/lib/campaignQuery";
import { getRoleFromRequest } from "@/lib/auth";

const COLUMNS: [string, (c: Record<string, unknown>) => unknown][] = [
  ["Handle", (c) => "@" + c.handle],
  ["Name", (c) => c.name],
  ["Instagram", (c) => c.instagramUrl],
  ["Followers", (c) => c.followers],
  ["Genres", (c) => (c.genres as string[]).join(", ")],
  ["City", (c) => c.city],
  ["Phones", (c) => (c.phones as string[]).join(", ")],
  ["Emails", (c) => (c.emails as string[]).join(", ")],
  ["Pipeline status", (c) => c.status],
  ["Rate", (c) => c.rate],
  ["Paid", (c) => (c.paid ? "Yes" : "No")],
  ["Deliverables", (c) => (c.deliverables as { type: string; status: string }[]).map((d) => `${d.type}: ${d.status}`).join("; ")],
  ["Notes", (c) => c.notes],
];

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type Ctx = { params: Promise<{ id: string }> };

/** CSV of a campaign's roster (opens directly in Excel). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const role = await getRoleFromRequest(req);
  const { id } = await params;
  const oid = parseObjectId(id);
  if (!oid) return Response.json({ error: "Invalid id" }, { status: 400 });
  const db = await getDb();
  const doc = await campaignsCollection(db).findOne({ _id: oid });
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });
  const creators = await creatorsCollection(db).find({ handle: { $in: doc.creators.map((c) => c.handle) } }).toArray();
  const dto = toCampaignDTO(doc, new Map(creators.map((c) => [c.handle, c])));

  const columns = role === "admin" ? COLUMNS : COLUMNS.filter(([h]) => h !== "Phones" && h !== "Emails");
  const lines = [columns.map(([h]) => h).join(",")];
  for (const c of dto.creators) lines.push(columns.map(([, get]) => cell(get(c as unknown as Record<string, unknown>))).join(","));
  const date = new Date().toISOString().slice(0, 10);
  const safeName = dto.name.replace(/[^\w.-]+/g, "-").slice(0, 60) || "campaign";
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-${date}.csv"`,
    },
  });
}
