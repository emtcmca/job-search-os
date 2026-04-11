import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const databasePath = resolve(process.cwd(), "data/job-search.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
const db = drizzle(sqlite);

migrate(db, {
  migrationsFolder: resolve(process.cwd(), "drizzle"),
});

sqlite.close();
