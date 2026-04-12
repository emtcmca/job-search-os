import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { jobs, jobSnapshots } from "@/lib/db/schema/jobs";

export const scores = sqliteTable("scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  snapshotId: integer("snapshot_id").references(() => jobSnapshots.id, {
    onDelete: "set null",
  }),
  tier: text("tier").notNull().default("tier_0"),
  overallScore: real("overall_score"),
  recommendation: text("recommendation").notNull().default("review"),
  recommendedResumeType: text("recommended_resume_type"),
  deepReviewRecommended: integer("deep_review_recommended", { mode: "boolean" })
    .default(false)
    .notNull(),
  deepReviewReason: text("deep_review_reason"),
  summary: text("summary"),
  reasonsForJson: text("reasons_for_json").default("[]").notNull(),
  reasonsAgainstJson: text("reasons_against_json").default("[]").notNull(),
  analyzedAt: text("analyzed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const scoreFactors = sqliteTable("score_factors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scoreId: integer("score_id")
    .notNull()
    .references(() => scores.id, { onDelete: "cascade" }),
  factorKey: text("factor_key").notNull(),
  factorLabel: text("factor_label").notNull(),
  weight: real("weight"),
  value: real("value"),
  explanation: text("explanation"),
});
