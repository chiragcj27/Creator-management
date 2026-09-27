import type { NextRequest } from "next/server";
import { creatorsCollection, getDb } from "@/lib/mongodb";
import { buildFilter, buildSort } from "@/lib/query";
import { getRoleFromRequest } from "@/lib/auth";

const COLUMNS: [string, (c: Record<string, unknown>) => unknown][] = [
  ["Handle", (c) => "@" + c.handle],
  ["Name", (c) => c.name],
  ["Instagram", (c) => c.instagramUrl],
  ["Followers", (c) => c.followers],
  ["Genres", (c) => (c.genres as string[]).join(", ")],
  ["Genre status", (c) => c.genreStatus],
  ["Gender", (c) => c.gender],
  ["Phones", (c) => (c.phones as string[]).join(", ")],
  ["Emails", (c) => (c.emails as string[]).join(", ")],
  ["City", (c) => c.city],
  ["State", (c) => c.state],
  ["Pincode", (c) => c.pincode],
  ["Address", (c) => c.address],
  ["Status", (c) => c.status],
  ["Lists", (c) => (c.lists as string[]).join(", ")],
  ["Tags", (c) => (c.tags as string[]).join(", ")],
  ["Manager", (c) => c.manager],
  ["Notes", (c) => c.notes],
];

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of every creator matching the current filters (opens directly in Excel). */
export async function GET(req: NextRequest) {
  const role = await getRoleFromRequest(req);
  const params = req.nextUrl.searchParams;
  const docs = await creatorsCollection(await getDb())
    .find(buildFilter(params), { projection: { details: 0, sources: 0 } })
    .collation({ locale: "en", strength: 2 })
    .sort(buildSort(params))
    .toArray();

  const columns = role === "admin" ? COLUMNS : COLUMNS.filter(([h]) => h !== "Phones" && h !== "Emails");
  const lines = [columns.map(([h]) => h).join(",")];
  for (const d of docs) lines.push(columns.map(([, get]) => cell(get(d as unknown as Record<string, unknown>))).join(","));
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creators-${date}.csv"`,
    },
  });
}
