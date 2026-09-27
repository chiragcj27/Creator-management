// Saves genres found by checking profiles in the browser.
// Usage: npm run genres:apply -- results.json
// results.json: [{ "handle": "abc", "genres": ["Fashion"], "followers": 12000, "confidence": "high" | "low", "bio": "..." }]
// Low-confidence results are saved but marked "needs-review" so someone can confirm them in the dashboard.
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { GENRES } from "../lib/genres";

loadEnvConfig(process.cwd());

interface Result {
  handle: string;
  genres: string[];
  followers?: number | null;
  confidence?: "high" | "low";
  bio?: string;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run genres:apply -- results.json");
  const results: Result[] = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")); // tolerate BOM from Windows editors
  const { creatorsCollection, getClient, getDb } = await import("../lib/mongodb");
  const col = creatorsCollection(await getDb());
  const now = new Date();

  let saved = 0;
  const unknown: string[] = [];
  const ops = results.map((r) => {
    const genres = r.genres.filter((g) => (GENRES as readonly string[]).includes(g));
    unknown.push(...r.genres.filter((g) => !genres.includes(g)));
    const set: Record<string, unknown> = {
      genres,
      genreSource: "browser",
      genreStatus: genres.length && r.confidence !== "low" ? "verified" : "needs-review",
      updatedAt: now,
    };
    if (typeof r.followers === "number" && r.followers > 0) set.followers = r.followers;
    if (r.bio) set.bio = r.bio;
    return { updateOne: { filter: { handle: r.handle.toLowerCase(), genreStatus: { $ne: "verified" as const } }, update: { $set: set } } };
  });
  if (ops.length) saved = (await col.bulkWrite(ops)).modifiedCount;

  console.log(`Updated ${saved} of ${results.length} creators (already-verified creators are left alone).`);
  if (unknown.length) console.log(`Ignored genres not in the list: ${[...new Set(unknown)].join(", ")}`);
  await (await getClient()).close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
