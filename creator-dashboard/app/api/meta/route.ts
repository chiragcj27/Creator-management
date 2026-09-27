import { creatorsCollection, getDb } from "@/lib/mongodb";
import { GENRES } from "@/lib/genres";

/** Counts for the stat tiles, the genre breakdown and the filter dropdowns. */
export async function GET() {
  const col = creatorsCollection(await getDb());
  const [facets] = await col
    .aggregate([
      {
        $facet: {
          total: [{ $count: "n" }],
          withPhone: [{ $match: { "phones.0": { $exists: true } } }, { $count: "n" }],
          withEmail: [{ $match: { "emails.0": { $exists: true } } }, { $count: "n" }],
          genreStatus: [{ $group: { _id: "$genreStatus", n: { $sum: 1 } } }],
          genres: [{ $unwind: "$genres" }, { $group: { _id: "$genres", n: { $sum: 1 } } }, { $sort: { n: -1 } }],
          lists: [{ $unwind: "$lists" }, { $group: { _id: "$lists", n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          tags: [{ $unwind: "$tags" }, { $group: { _id: "$tags", n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          statuses: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
          cities: [{ $match: { city: { $ne: null } } }, { $group: { _id: "$city", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 150 }],
          states: [{ $match: { state: { $ne: null } } }, { $group: { _id: "$state", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 60 }],
        },
      },
    ])
    .toArray();

  const pairs = (arr: { _id: string; n: number }[]) => arr.map((x) => ({ value: x._id, count: x.n }));
  const one = (arr: { n: number }[]) => arr[0]?.n ?? 0;
  const lastImport = await (await getDb()).collection("imports").find().sort({ importedAt: -1 }).limit(1).next();

  return Response.json({
    total: one(facets.total),
    withPhone: one(facets.withPhone),
    withEmail: one(facets.withEmail),
    genreStatus: Object.fromEntries(facets.genreStatus.map((x: { _id: string; n: number }) => [x._id, x.n])),
    genres: pairs(facets.genres),
    allGenres: GENRES,
    lists: pairs(facets.lists),
    tags: pairs(facets.tags),
    statuses: pairs(facets.statuses),
    cities: pairs(facets.cities),
    states: pairs(facets.states),
    lastImport: lastImport ? { file: lastImport.file, importedAt: lastImport.importedAt } : null,
  });
}
