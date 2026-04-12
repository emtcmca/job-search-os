import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolveSqliteDatabasePath } from "@/lib/runtime/deployment";

const migrationsFolder = resolve(process.cwd(), "drizzle");
const databasePath = resolveSqliteDatabasePath();
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
const db = drizzle(sqlite);

migrate(db, {
  migrationsFolder,
});

sqlite.close();
