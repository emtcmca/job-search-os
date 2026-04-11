import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";

const databasePath = resolve(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.DATABASE_URL ?? "data/job-search.sqlite",
);

mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);

export const db = drizzle(sqlite, { schema });
