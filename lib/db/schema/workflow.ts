import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { generatedDocuments } from "@/lib/db/schema/profiles";
import { jobs } from "@/lib/db/schema/jobs";

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  platform: text("platform"),
  status: text("status").notNull().default("new"),
  submittedAt: text("submitted_at"),
  submissionUrl: text("submission_url"),
  submissionReference: text("submission_reference"),
  resumeDocId: integer("resume_doc_id").references(() => generatedDocuments.id),
  coverLetterDocId: integer("cover_letter_doc_id").references(
    () => generatedDocuments.id,
  ),
  followUpRequired: integer("follow_up_required", { mode: "boolean" })
    .default(false)
    .notNull(),
  followUpInstructions: text("follow_up_instructions"),
  notes: text("notes"),
});

export const applicationEvents = sqliteTable("application_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").default("{}").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  applicationId: integer("application_id").references(() => applications.id, {
    onDelete: "cascade",
  }),
  body: text("body").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const reminders = sqliteTable("reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  applicationId: integer("application_id").references(() => applications.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  dueAt: text("due_at").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
