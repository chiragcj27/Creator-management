import { MongoClient, type Db } from "mongodb";
import type { Creator } from "./types";

const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient>; _indexesReady?: Promise<void> };

export function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local (see README).");
  // Reuse one client across hot reloads in dev and across requests in production.
  globalForMongo._mongoClient ??= new MongoClient(uri).connect();
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  const db = (await getClient()).db(process.env.MONGODB_DB || "creator_dashboard");
  globalForMongo._indexesReady ??= ensureIndexes(db);
  await globalForMongo._indexesReady;
  return db;
}

export const creatorsCollection = (db: Db) => db.collection<Creator>("creators");

async function ensureIndexes(db: Db) {
  const col = creatorsCollection(db);
  await Promise.all([
    col.createIndex({ handle: 1 }, { unique: true }),
    col.createIndex({ genres: 1 }),
    col.createIndex({ lists: 1 }),
    col.createIndex({ status: 1 }),
    col.createIndex({ followers: -1 }),
    col.createIndex({ city: 1 }),
    col.createIndex({ genreStatus: 1 }),
  ]);
}
