// Lists the next creators whose genre still needs checking on Instagram, biggest first.
// Usage: npm run genres:queue -- [--limit 50] [--skip-list Jewellery] [--out queue.json]
import { writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function main() {
  const { creatorsCollection, getClient, getDb } = await import("../lib/mongodb");
  const limit = Number(arg("limit", "50"));
  const skipList = arg("skip-list"); // e.g. leave creators who are *only* in the Jewellery sign-up list for later
  const out = arg("out", "genre-queue.json")!;

  const filter: Record<string, unknown> = { genreStatus: { $in: ["untagged", "needs-review"] } };
  if (skipList) filter.lists = { $elemMatch: { $ne: skipList } };

  const rows = await creatorsCollection(await getDb())
    .find(filter, { projection: { _id: 0, handle: 1, name: 1, followers: 1, nicheRaw: 1, lists: 1 } })
    .sort({ followers: -1 })
    .limit(limit)
    .toArray();

  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log(`Wrote ${rows.length} creators to ${out}`);
  await (await getClient()).close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
