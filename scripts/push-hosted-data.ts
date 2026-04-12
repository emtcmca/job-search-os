import Database from "better-sqlite3";
import { createClient } from "@libsql/client";

import "./load-env";
import {
  getHostedDatabaseTargetStatus,
  resolveSqliteDatabasePath,
} from "@/lib/runtime/deployment";

const syncTableOrder = [
  "companies",
  "candidate_profiles",
  "ai_budget_settings",
  "platform_connections",
  "inbox_connections",
  "saved_searches",
  "jobs",
  "job_snapshots",
  "scores",
  "score_factors",
  "generated_documents",
  "applications",
  "application_events",
  "notes",
  "reminders",
  "inbox_messages",
  "ai_usage_events",
  "linear_links",
  "user_feedback_signals",
] as const;

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    value instanceof ArrayBuffer ||
    value instanceof Uint8Array
  ) {
    return value;
  }

  return String(value);
}

async function main() {
  const target = getHostedDatabaseTargetStatus();
  if (!target.ready || !target.url) {
    throw new Error(target.message);
  }

  const local = new Database(resolveSqliteDatabasePath(), { readonly: true });
  const remote = createClient({
    url: target.url,
    authToken: process.env.HOSTED_DATABASE_AUTH_TOKEN?.trim() || undefined,
  });

  try {
    const availableTables = new Set(
      (
        local
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
          )
          .all() as Array<{ name: string }>
      ).map((row) => row.name),
    );

    const tables = syncTableOrder.filter((table) => availableTables.has(table));

    await remote.execute("PRAGMA foreign_keys = OFF");

    for (const table of [...tables].reverse()) {
      await remote.execute(`DELETE FROM ${quoteIdentifier(table)}`);
    }

    let copiedRows = 0;

    for (const table of tables) {
      const columnRows = local
        .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
        .all() as Array<{ name: string }>;
      const columns = columnRows.map((row) => row.name);
      const rows = local
        .prepare(`SELECT * FROM ${quoteIdentifier(table)}`)
        .all() as Array<Record<string, unknown>>;

      if (rows.length === 0 || columns.length === 0) {
        continue;
      }

      const columnList = columns.map(quoteIdentifier).join(", ");
      const placeholders = columns.map(() => "?").join(", ");
      const sql = `INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES (${placeholders})`;

      for (const row of rows) {
        await remote.execute({
          sql,
          args: columns.map((column) => normalizeValue(row[column])),
        });
      }

      copiedRows += rows.length;
      console.log(`Copied ${rows.length} row(s) into ${table}.`);
    }

    await remote.execute("PRAGMA foreign_keys = ON");

    console.log(`Hosted database sync complete. ${copiedRows} row(s) copied.`);
  } finally {
    remote.close();
    local.close();
  }
}

void main();
