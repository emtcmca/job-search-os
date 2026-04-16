import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";

import * as schema from "@/lib/db/schema";
import {
  getHostedDatabaseTargetStatus,
  getRuntimeEnvironmentSummary,
  resolveSqliteDatabasePath,
} from "@/lib/runtime/deployment";

const runtime = getRuntimeEnvironmentSummary();
const hostedTarget = getHostedDatabaseTargetStatus();

let sqliteDatabase: Database.Database | null = null;
let libsqlClient: ReturnType<typeof createClient> | null = null;

if (runtime.database.kind === "sqlite_file") {
  const databasePath = resolveSqliteDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });
  sqliteDatabase = new Database(databasePath);
  // OneDrive-backed workspaces can throw SQLITE_IOERR_DELETE when SQLite tries to
  // remove rollback journal files. PERSIST keeps the journal file in place.
  sqliteDatabase.pragma("busy_timeout = 5000");
  sqliteDatabase.pragma("journal_mode = PERSIST");
  sqliteDatabase.pragma("synchronous = NORMAL");
} else if (runtime.database.kind === "libsql_hosted" && hostedTarget.url) {
  libsqlClient = createClient({
    url: hostedTarget.url,
    authToken: process.env.HOSTED_DATABASE_AUTH_TOKEN?.trim() || undefined,
  });
}

export const sqlite = sqliteDatabase;
export const db = (sqliteDatabase
  ? drizzleSqlite(sqliteDatabase, { schema })
  : drizzleLibsql(libsqlClient!, { schema })) as any;
