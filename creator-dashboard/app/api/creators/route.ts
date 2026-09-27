import type { NextRequest } from "next/server";
import { creatorsCollection, getDb } from "@/lib/mongodb";
import { buildFilter, buildSort, toDTO } from "@/lib/query";
import { newCreator } from "@/lib/merge";
import { cleanName, cleanPlace, handleFromText, handleFromUrl, parseEmails, parseFollowers, parseGender, parsePhones } from "@/lib/parse";
import { GENRES } from "@/lib/genres";
import { getRoleFromRequest, redactContacts } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const role = await getRoleFromRequest(req);
  const params = req.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(params.get("pageSize")) || 50));
  const col = creatorsCollection(await getDb());
  const filter = buildFilter(params);

  const [items, total] = await Promise.all([
    col
      .find(filter, { projection: { details: 0, sources: 0, address: 0 } })
      .collation({ locale: "en", strength: 2 })
      .sort(buildSort(params))
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    col.countDocuments(filter),
  ]);
  return Response.json({ items: items.map((d) => redactContacts(toDTO(d), role)), total, page, pageSize });
}

/**
 * Add one creator by hand. Body: { instagram, name?, followers?, phone?, email?, city?, state?, gender?, genres?, notes? }
 * The restricted role can still capture a new creator's contact details at intake — it just can't see or
 * edit contact details already on file, which is enforced by redacting the response below.
 */
export async function POST(req: NextRequest) {
  const role = await getRoleFromRequest(req);
  const body = await req.json().catch(() => null);
  const handle = handleFromUrl(body?.instagram) ?? handleFromText(body?.instagram);
  if (!handle) return Response.json({ error: "Enter a valid Instagram profile link or @handle." }, { status: 400 });

  const col = creatorsCollection(await getDb());
  if (await col.findOne({ handle }, { projection: { _id: 1 } })) {
    return Response.json({ error: `@${handle} is already in the dashboard.`, handle }, { status: 409 });
  }

  const c = newCreator(handle);
  c.name = cleanName(body.name);
  c.followers = parseFollowers(body.followers);
  c.phones = parsePhones(body.phone);
  c.emails = parseEmails(body.email);
  c.city = cleanPlace(body.city);
  c.state = cleanPlace(body.state);
  c.gender = parseGender(body.gender);
  c.notes = typeof body.notes === "string" ? body.notes : "";
  c.lists = ["Added manually"];
  const genres = Array.isArray(body.genres) ? body.genres.filter((g: unknown) => (GENRES as readonly unknown[]).includes(g)) : [];
  if (genres.length) {
    c.genres = genres;
    c.genreStatus = "verified";
    c.genreSource = "manual";
  }
  const res = await col.insertOne(c);
  return Response.json(redactContacts(toDTO({ ...c, _id: res.insertedId }), role), { status: 201 });
}
