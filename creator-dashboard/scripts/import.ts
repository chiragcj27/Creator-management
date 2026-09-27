// Usage: npm run import -- "../yash sheet creator.xlsx" [more files...]
//        npm run import -- --dry-run "../file.xlsx"   (parse only, print what would be imported)
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadEnvConfig } from "@next/env";
import { importWorkbook, parseWorkbook } from "../lib/importer";

loadEnvConfig(process.cwd());

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const files = args.filter((a) => a !== "--dry-run");
  if (!files.length) {
    console.error('Usage: npm run import -- [--dry-run] "<file.xlsx>" ...');
    process.exit(1);
  }

  if (dryRun) {
    for (const f of files) {
      const p = parseWorkbook(readFileSync(f), basename(f));
      const all = [...p.creators.values()];
      const count = (fn: (c: (typeof all)[number]) => boolean) => all.filter(fn).length;
      console.log(`\n${basename(f)}`);
      console.log(`  sheets read: ${p.sheetsRead.length}, skipped: ${p.sheetsSkipped.join(", ") || "none"}`);
      console.log(`  rows with a creator: ${p.rowsWithCreator}, unique creators: ${all.length}`);
      console.log(`  with phone: ${count((c) => c.phones.length > 0)}, email: ${count((c) => c.emails.length > 0)}, followers: ${count((c) => c.followers !== null)}, city: ${count((c) => !!c.city)}`);
      console.log(`  genre auto-tagged: ${count((c) => c.genres.length > 0)}, needs review: ${count((c) => c.genreStatus === "needs-review")}, gender known: ${count((c) => !!c.gender)}`);
      console.log(`  rows skipped (no Instagram handle): ${p.skipped.length}`);
      for (const s of p.skipped.slice(0, 15)) console.log(`    ${s.sheet} row ${s.row}: ${s.name} | ${s.value}`);
    }
    return;
  }

  const { getClient, getDb } = await import("../lib/mongodb");
  const db = await getDb();
  for (const f of files) {
    const s = await importWorkbook(db, readFileSync(f), basename(f));
    console.log(`\n${s.file}: ${s.uniqueInFile} creators (${s.inserted} new, ${s.updated} merged into existing), ${s.skippedRows} rows skipped`);
  }
  await (await getClient()).close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
