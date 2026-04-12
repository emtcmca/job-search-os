import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const savedSearches = sqliteTable("saved_searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull().default("full_time"),
  keywords: text("keywords").notNull(),
  filtersJson: text("filters_json").default("{}").notNull(),
  sourcesJson: text("sources_json").default("[]").notNull(),
  scheduleJson: text("schedule_json").default("{}").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  lastRunAt: text("last_run_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
