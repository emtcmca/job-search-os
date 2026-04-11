import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { applications } from "@/lib/db/schema/workflow";
import { jobs } from "@/lib/db/schema/jobs";

export const platformConnections = sqliteTable("platform_connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull(),
  browserType: text("browser_type"),
  browserProfileName: text("browser_profile_name"),
  connectionMode: text("connection_mode").default("launch").notNull(),
  debugPort: integer("debug_port"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(false).notNull(),
  notes: text("notes"),
  lastVerifiedAt: text("last_verified_at"),
});

export const linearLinks = sqliteTable("linear_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  applicationId: integer("application_id").references(() => applications.id, {
    onDelete: "cascade",
  }),
  linearProjectKey: text("linear_project_key").notNull(),
  linearIssueId: text("linear_issue_id"),
  syncState: text("sync_state").notNull().default("pending"),
  lastSyncedAt: text("last_synced_at"),
});

export const userFeedbackSignals = sqliteTable("user_feedback_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  signalType: text("signal_type").notNull(),
  value: text("value"),
  metadataJson: text("metadata_json").default("{}").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const aiUsageEvents = sqliteTable("ai_usage_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  snapshotHash: text("snapshot_hash"),
  tier: text("tier").notNull(),
  model: text("model"),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  wasUserApproved: integer("was_user_approved", { mode: "boolean" })
    .default(false)
    .notNull(),
  cacheHit: integer("cache_hit", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const aiBudgetSettings = sqliteTable("ai_budget_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monthlyBudget: real("monthly_budget").notNull().default(25),
  warningThreshold: real("warning_threshold").notNull().default(0.8),
  hardLimitEnabled: integer("hard_limit_enabled", { mode: "boolean" })
    .default(true)
    .notNull(),
  neverAutoRunDeepAnalysis: integer("never_auto_run_deep_analysis", {
    mode: "boolean",
  })
    .default(true)
    .notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
