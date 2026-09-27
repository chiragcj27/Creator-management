import type { NextRequest } from "next/server";
import { creatorsCollection, getDb } from "@/lib/mongodb";
import { toDTO } from "@/lib/query";
import { GENRES } from "@/lib/genres";
import { GENRE_STATUSES, STATUSES, type Creator } from "@/lib/types";
import { cleanPincode, cleanPlace, parseEmails, parsePhones } from "@/lib/parse";
import { getRoleFromRequest, redactContacts, stripContactInput } from "@/lib/auth";

type Ctx = { params: Promise<{ handle: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const role = await getRoleFromRequest(req);
  const { handle } = await params;
  const doc = await creatorsCollection(await getDb()).findOne({ handle: handle.toLowerCase() });
  return doc ? Response.json(redactContacts(toDTO(doc), role)) : Response.json({ error: "Not found" }, { status: 404 });
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const strList = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x.trim()).map((x: string) => x.trim()))] : null);

/**
 * Partial update. Setting `genres` marks them verified unless `genreStatus` is also sent;
 * pass genreSource: "browser" when the genre came from checking the profile.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const role = await getRoleFromRequest(req);
  const { handle } = await params;
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") return Response.json({ error: "Invalid body" }, { status: 400 });
  const body = stripContactInput(raw, role);

  const set: Partial<Creator> = {};
  if ("name" in body) set.name = str(body.name);
  if ("followers" in body) set.followers = Number.isFinite(Number(body.followers)) && body.followers !== null && body.followers !== "" ? Math.round(Number(body.followers)) : null;
  if ("gender" in body) set.gender = body.gender === "Male" || body.gender === "Female" ? body.gender : null;
  if ("phones" in body) set.phones = (strList(body.phones) ?? []).flatMap(parsePhones);
  if ("emails" in body) set.emails = (strList(body.emails) ?? []).flatMap(parseEmails);
  if ("city" in body) set.city = cleanPlace(body.city);
  if ("state" in body) set.state = cleanPlace(body.state);
  if ("pincode" in body) set.pincode = cleanPincode(body.pincode);
  if ("address" in body) set.address = str(body.address);
  if ("manager" in body) set.manager = str(body.manager);
  if ("notes" in body) set.notes = typeof body.notes === "string" ? body.notes : "";
  if ("tags" in body) set.tags = strList(body.tags) ?? [];
  if ("status" in body) {
    if (!STATUSES.includes(body.status)) return Response.json({ error: "Unknown status" }, { status: 400 });
    set.status = body.status;
  }
  if ("genres" in body) {
    const genres = (strList(body.genres) ?? []).filter((g) => (GENRES as readonly string[]).includes(g));
    set.genres = genres;
    set.genreStatus = genres.length ? "verified" : "untagged";
    set.genreSource = genres.length ? (body.genreSource === "browser" ? "browser" : "manual") : null;
  }
  if ("genreStatus" in body) {
    if (!GENRE_STATUSES.includes(body.genreStatus)) return Response.json({ error: "Unknown genreStatus" }, { status: 400 });
    set.genreStatus = body.genreStatus;
  }

  const doc = await creatorsCollection(await getDb()).findOneAndUpdate(
    { handle: handle.toLowerCase() },
    { $set: { ...set, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return doc ? Response.json(redactContacts(toDTO(doc), role)) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { handle } = await params;
  const res = await creatorsCollection(await getDb()).deleteOne({ handle: handle.toLowerCase() });
  return res.deletedCount ? new Response(null, { status: 204 }) : Response.json({ error: "Not found" }, { status: 404 });
}
