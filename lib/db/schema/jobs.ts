import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { companies } from "@/lib/db/schema/companies";

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobType: text("job_type").notNull().default("full_time"),
  source: text("source").notNull(),
  sourceJobId: text("source_job_id"),
  sourceUrl: text("source_url").notNull(),
  title: text("title").notNull(),
  companyId: integer("company_id").references(() => companies.id),
  locationText: text("location_text"),
  locationType: text("location_type"),
  employmentType: text("employment_type"),
  salaryMin: real("salary_min"),
  salaryMax: real("salary_max"),
  currency: text("currency").default("USD"),
  isRejected: integer("is_rejected", { mode: "boolean" }).default(false).notNull(),
  currentStage: text("current_stage").notNull().default("new"),
  dedupeKey: text("dedupe_key").notNull(),
  discoveredAt: text("discovered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const jobSnapshots = sqliteTable("job_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  snapshotHash: text("snapshot_hash").notNull(),
  rawText: text("raw_text"),
  rawHtmlPath: text("raw_html_path"),
  parsedJson: text("parsed_json").default("{}").notNull(),
  capturedAt: text("captured_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
