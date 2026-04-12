import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import "./load-env";
import { createClient } from "@libsql/client";

import { getHostedDatabaseTargetStatus } from "@/lib/runtime/deployment";

const migrationsFolder = resolve(process.cwd(), "drizzle");

function splitSqlStatements(contents: string) {
  return contents
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function ensureMigrationsTable(client: ReturnType<typeof createClient>) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "hash" text NOT NULL,
      "created_at" numeric
    )
  `);
}

async function listMigrationFiles() {
  const entries = await readdir(migrationsFolder, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function main() {
  const target = getHostedDatabaseTargetStatus();
  if (!target.ready || !target.url) {
    throw new Error(target.message);
  }

  const client = createClient({
    url: target.url,
    authToken: process.env.HOSTED_DATABASE_AUTH_TOKEN?.trim() || undefined,
  });

  try {
    await ensureMigrationsTable(client);

    const appliedRows = await client.execute(
      `SELECT "hash" FROM "__drizzle_migrations" ORDER BY "id" ASC`,
    );
    const appliedHashes = new Set(
      appliedRows.rows.map((row) => String(row.hash ?? "")).filter(Boolean),
    );

    const migrationFiles = await listMigrationFiles();

    for (const fileName of migrationFiles) {
      if (appliedHashes.has(fileName)) {
        continue;
      }

      const filePath = resolve(migrationsFolder, fileName);
      const contents = await readFile(filePath, "utf8");
      const statements = splitSqlStatements(contents);

      for (const statement of statements) {
        await client.execute(statement);
      }

      await client.execute({
        sql: `INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)`,
        args: [fileName, Date.now()],
      });

      console.log(`Applied hosted migration ${fileName}.`);
    }

    console.log(`Hosted migrations applied successfully to ${target.url}.`);
  } finally {
    client.close();
  }
}

void main();
