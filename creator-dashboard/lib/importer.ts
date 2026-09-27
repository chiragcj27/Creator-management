import * as XLSX from "xlsx";
import type { Db } from "mongodb";
import type { Creator, Detail, Gender, ImportSummary } from "./types";
import { detectGenres, isUgc } from "./genres";
import { sheetConfig } from "./sheetConfig";
import {
  cleanName,
  cleanPincode,
  cleanPlace,
  cleanText,
  excelDate,
  handleFromText,
  handleFromUrl,
  instagramUrl,
  looksLikePhoneCell,
  parseEmails,
  parseFollowers,
  parseGender,
  parsePhones,
} from "./parse";
import { mergeCreators, newCreator } from "./merge";
import { creatorsCollection } from "./mongodb";

type Role =
  | "name" | "link" | "username" | "followers" | "phone" | "email" | "address" | "city" | "state"
  | "cityState" | "pincode" | "niche" | "gender" | "manager" | "avgViews" | "timestamp" | "ignore" | "detail";

function roleOf(header: unknown): Role {
  const h = String(header ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!h || h.length > 60 || /^column \d+$|^s\.? ?no\.?$|^sr\.? ?no|^score$/.test(h)) return "ignore";
  if (/timestamp/.test(h)) return "timestamp";
  if (/username/.test(h)) return "username";
  if (/story|posted|reel/.test(h)) return "detail";
  if (/contact person|manager/.test(h)) return "manager";
  if (/mail/.test(h)) return "email";
  if (/follower/.test(h)) return "followers";
  if (/insta|profile|^ig$|intsa|link/.test(h)) return "link";
  if (/contact|phone|mobile|^number$/.test(h)) return "phone";
  if (/city and state/.test(h)) return "cityState";
  if (/address/.test(h)) return "address";
  if (/^city/.test(h)) return "city";
  if (/^state/.test(h)) return "state";
  if (/pin ?code|^pin$/.test(h)) return "pincode";
  if (/niche|genre/.test(h)) return "niche";
  if (/^m\/f$|gender/.test(h)) return "gender";
  if (/average views|avg/.test(h)) return "avgViews";
  if (/name|^above$/.test(h)) return "name";
  return "detail";
}

const hasIgLink = (row: unknown[]) => row.some((c) => /in[a-z]{0,3}gram\.com\//i.test(String(c)));

function isHeaderRow(row: unknown[]): boolean {
  if (hasIgLink(row)) return false;
  let known = 0;
  for (const c of row) {
    const s = String(c).trim();
    if (!s || s.length > 60 || /@|\d{4,}/.test(s) || typeof c === "number") continue;
    const r = roleOf(s);
    if (r !== "detail" && r !== "ignore") known++;
  }
  return known >= 2;
}

interface Column { index: number; role: Role; header: string }
interface Group { start: number; columns: Column[]; gender: Gender | null }

/** Splits a header row into side-by-side tables (e.g. a MALE block and a FEMALE block on one sheet). */
function buildGroups(header: unknown[], markers: Map<number, Gender>): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  header.forEach((cell, index) => {
    const role = roleOf(cell);
    if (role === "ignore" && !current) return;
    const repeats = current && (role === "name" || role === "link") && current.columns.some((c) => c.role === role);
    if (!current || repeats) {
      current = { start: index, columns: [], gender: null };
      groups.push(current);
    }
    current.columns.push({ index, role, header: String(cell).replace(/\s+/g, " ").trim() });
  });
  for (const g of groups) {
    let best: [number, Gender] | null = null;
    for (const [col, gender] of markers) if (col <= g.start && (!best || col > best[0])) best = [col, gender];
    g.gender = best?.[1] ?? (markers.size === 1 ? [...markers.values()][0] : null);
  }
  return groups;
}

type RowResult =
  | { ok: true; creator: Creator }
  | { ok: false; name: string; value: string };

function parseRow(row: unknown[], group: Group, list: string, cfg: ReturnType<typeof sheetConfig>, source: Creator["sources"][number]): RowResult | null {
  const cols = group.columns;
  const cell = (c: Column) => row[c.index];
  const byRole = (r: Role) => cols.filter((c) => c.role === r);
  const first = (r: Role) => byRole(r).map(cell).find((v) => cleanText(v) !== null);
  const groupCells = cols.map(cell);

  if (!groupCells.some((v) => cleanText(v) !== null)) return null;

  let handle: string | null = null;
  for (const c of byRole("link")) handle ??= handleFromUrl(cell(c)) ?? handleFromText(cell(c));
  for (const c of byRole("username")) handle ??= handleFromUrl(cell(c)) ?? handleFromText(cell(c));
  if (!handle) for (const c of cols) if (c.role !== "detail") handle ??= handleFromUrl(cell(c));

  const name = cleanName(first("name"));
  if (!handle) {
    const value = cleanText(first("link") ?? first("username")) ?? "";
    return name || value ? { ok: false, name: name ?? "", value: value.slice(0, 120) } : null;
  }

  const c = newCreator(handle);
  c.instagramUrl = instagramUrl(handle);
  c.name = name;
  c.lists = [list];
  c.sources = [source];
  c.tags = [...(cfg.tags ?? [])];

  c.followers = parseFollowers(first("followers"));
  c.avgViews = parseFollowers(first("avgViews"));

  c.phones = byRole("phone").flatMap((col) => parsePhones(cell(col)));
  if (!c.phones.length) {
    const skip = new Set<Role>(["followers", "pincode", "timestamp", "avgViews"]);
    c.phones = cols.filter((col) => !skip.has(col.role) && looksLikePhoneCell(cell(col))).flatMap((col) => parsePhones(cell(col)));
  }
  c.emails = [...new Set(groupCells.flatMap(parseEmails))];

  c.address = cleanText(first("address"));
  c.city = cleanPlace(first("city"));
  c.state = cleanPlace(first("state"));
  const cityState = cleanText(first("cityState"));
  if (cityState) {
    const [city, state] = cityState.split(/\s*[,\-]\s*/);
    c.city ??= cleanPlace(city);
    c.state ??= cleanPlace(state);
  }
  c.pincode = cleanPincode(first("pincode"));
  c.gender = parseGender(first("gender")) ?? group.gender;
  c.manager = cleanName(first("manager"));
  c.firstSeenAt = excelDate(first("timestamp"));

  const niche = cleanText(first("niche"));
  const selfGenres = niche ? detectGenres(niche) : [];
  if (niche) {
    c.nicheRaw = [niche];
    if (isUgc(niche)) c.tags.push("UGC");
  }
  if (cfg.genres?.length) {
    c.genres = [...new Set([...cfg.genres, ...selfGenres])];
    c.genreSource = "sheet";
  } else if (selfGenres.length) {
    c.genres = selfGenres;
    c.genreSource = "self-reported";
  }
  c.genreStatus = c.genres.length ? "auto" : niche ? "needs-review" : "untagged";

  c.details = byRole("detail")
    .map((col): Detail | null => {
      const v = cleanText(cell(col));
      return v && col.header ? { list, field: col.header, value: v } : null;
    })
    .filter((d): d is Detail => d !== null);

  return { ok: true, creator: c };
}

export interface ParsedWorkbook {
  creators: Map<string, Creator>;
  sheetsRead: string[];
  sheetsSkipped: string[];
  rowsWithCreator: number;
  skipped: ImportSummary["skippedExamples"];
}

export function parseWorkbook(buffer: ArrayBuffer | Buffer, fileName: string): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: buffer instanceof ArrayBuffer ? "array" : "buffer" });
  const out: ParsedWorkbook = { creators: new Map(), sheetsRead: [], sheetsSkipped: [], rowsWithCreator: 0, skipped: [] };

  for (const sheetName of wb.SheetNames) {
    const cfg = sheetConfig(sheetName);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "", raw: true });
    if (cfg.skip || !rows.length) {
      out.sheetsSkipped.push(sheetName);
      continue;
    }
    let active = cfg;
    let list = cfg.label ?? sheetName.trim();
    let groups: Group[] | null = null;
    const markers = new Map<number, Gender>();
    let found = 0;

    rows.forEach((raw, i) => {
      const row = i === 0 && cfg.headerOverride ? cfg.headerOverride : raw;
      if (isHeaderRow(row)) {
        groups = buildGroups(row, markers);
        markers.clear();
        return;
      }
      let parsedAny = false;
      for (const g of (groups ?? []) as Group[]) {
        const res = parseRow(row, g, list, active, { file: fileName, sheet: sheetName, row: i + 1 });
        if (!res) continue;
        if (res.ok) {
          parsedAny = true;
          found++;
          out.rowsWithCreator++;
          const prev = out.creators.get(res.creator.handle);
          out.creators.set(res.creator.handle, prev ? mergeCreators(prev, res.creator, { preferFullerName: true }) : res.creator);
        } else {
          const filled = row.filter((v) => cleanText(v) !== null);
          const isMarker = filled.length <= 2 && filled.every((v) => typeof v === "string" && v.length < 40 && !/\d{5,}|@/.test(v));
          if (!isMarker) out.skipped.push({ sheet: sheetName, row: i + 1, name: res.name, value: res.value });
        }
      }
      if (!parsedAny) {
        const section = cfg.sections?.find((s) => row.some((v) => s.marker.test(String(v))));
        if (section) {
          active = { ...section, sections: undefined };
          list = section.label ?? list;
        }
        row.forEach((v, col) => {
          const g = typeof v === "string" && v.trim().length < 30 ? parseGender(v) : null;
          if (g) markers.set(col, g);
        });
      }
    });
    (found ? out.sheetsRead : out.sheetsSkipped).push(sheetName);
  }
  return out;
}

export async function importWorkbook(db: Db, buffer: ArrayBuffer | Buffer, fileName: string): Promise<ImportSummary> {
  const parsed = parseWorkbook(buffer, fileName);
  const col = creatorsCollection(db);
  const handles = [...parsed.creators.keys()];
  let inserted = 0;
  let updated = 0;
  const now = new Date();

  for (let i = 0; i < handles.length; i += 500) {
    const chunk = handles.slice(i, i + 500);
    const existing = new Map((await col.find({ handle: { $in: chunk } }).toArray()).map((d) => [d.handle, d]));
    const ops = chunk.map((handle) => {
      const incoming = parsed.creators.get(handle)!;
      const prev = existing.get(handle);
      let doc: Creator;
      if (prev) {
        const { _id, ...rest } = prev;
        void _id; // replaceOne keeps the existing _id
        doc = { ...mergeCreators(rest, incoming), updatedAt: now };
        updated++;
      } else {
        doc = { ...incoming, createdAt: now, updatedAt: now };
        inserted++;
      }
      return { replaceOne: { filter: { handle }, replacement: doc, upsert: true } };
    });
    if (ops.length) await col.bulkWrite(ops, { ordered: false });
  }

  const summary: ImportSummary = {
    file: fileName,
    sheetsRead: parsed.sheetsRead,
    sheetsSkipped: parsed.sheetsSkipped,
    rowsWithCreator: parsed.rowsWithCreator,
    uniqueInFile: parsed.creators.size,
    inserted,
    updated,
    skippedRows: parsed.skipped.length,
    skippedExamples: parsed.skipped.slice(0, 50),
  };
  await db.collection("imports").insertOne({ ...summary, importedAt: now });
  return summary;
}
