import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const candidateProfiles = sqliteTable("candidate_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  profileType: text("profile_type").notNull(),
  sourceDocPath: text("source_doc_path"),
  contentJson: text("content_json").default("{}").notNull(),
  isCanonical: integer("is_canonical", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const generatedDocuments = sqliteTable("generated_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id"),
  documentType: text("document_type").notNull(),
  profileId: integer("profile_id").references(() => candidateProfiles.id),
  version: integer("version").notNull().default(1),
  filePath: text("file_path"),
  contentText: text("content_text"),
  provenanceJson: text("provenance_json").default("{}").notNull(),
  approvalState: text("approval_state").notNull().default("draft"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
