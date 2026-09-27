// Runs a local MongoDB on port 27017 with data saved in ./.mongo-data, for trying the dashboard
// without installing MongoDB. Keep this running in its own terminal. For team use, use MongoDB Atlas instead.
import { mkdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

async function main() {
  const dbPath = ".mongo-data";
  mkdirSync(dbPath, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { port: 27017, dbPath, storageEngine: "wiredTiger" },
  });
  console.log(`Local MongoDB running at ${server.getUri()} (data in ${dbPath}/). Press Ctrl+C to stop.`);
  const stop = async () => {
    await server.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
