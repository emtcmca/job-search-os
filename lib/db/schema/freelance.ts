import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { jobs } from "@/lib/db/schema/jobs";
import { candidateProfiles } from "@/lib/db/schema/profiles";

export const freelancePositioningProfiles = sqliteTable(
  "freelance_positioning_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    sourceProfileId: integer("source_profile_id").references(
      () => candidateProfiles.id,
      { onDelete: "set null" },
    ),
    isDefault: integer("is_default", { mode: "boolean" }).default(false).notNull(),
    servicesJson: text("services_json").default("[]").notNull(),
    pricingJson: text("pricing_json").default("{}").notNull(),
    voiceJson: text("voice_json").default("{}").notNull(),
    proofPointsJson: text("proof_points_json").default("[]").notNull(),
    bannedClaimsJson: text("banned_claims_json").default("[]").notNull(),
    platformPreferencesJson: text("platform_preferences_json").default("{}").notNull(),
    notes: text("notes"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
);

export const freelanceNiches = sqliteTable("freelance_niches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").references(
    () => freelancePositioningProfiles.id,
    { onDelete: "set null" },
  ),
  legacySourceId: text("legacy_source_id"),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  demand: text("demand").notNull().default("Medium"),
  rationale: text("rationale").notNull(),
  platformsJson: text("platforms_json").default("[]").notNull(),
  buyer: text("buyer"),
  edge: text("edge"),
  status: text("status").notNull().default("candidate"),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const freelanceServiceListings = sqliteTable(
  "freelance_service_listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    nicheId: integer("niche_id").references(() => freelanceNiches.id, {
      onDelete: "set null",
    }),
    profileId: integer("profile_id").references(
      () => freelancePositioningProfiles.id,
      { onDelete: "set null" },
    ),
    legacySourceId: text("legacy_source_id"),
    platform: text("platform").notNull(),
    format: text("format").notNull().default("generic"),
    title: text("title").notNull(),
    contentJson: text("content_json").default("{}").notNull(),
    performanceJson: text("performance_json").default("{}").notNull(),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
);

export const freelanceListingVersions = sqliteTable(
  "freelance_listing_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => freelanceServiceListings.id, { onDelete: "cascade" }),
    contentJson: text("content_json").default("{}").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
);

export const freelanceGeneratedDrafts = sqliteTable(
  "freelance_generated_drafts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
    profileId: integer("profile_id").references(
      () => freelancePositioningProfiles.id,
      { onDelete: "set null" },
    ),
    platform: text("platform").notNull(),
    draftType: text("draft_type").notNull().default("proposal"),
    tone: text("tone").notNull().default("balanced"),
    promptJson: text("prompt_json").default("{}").notNull(),
    fitJson: text("fit_json").default("{}").notNull(),
    contentText: text("content_text").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
);

export const freelanceSocialPosts = sqliteTable("freelance_social_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").references(
    () => freelancePositioningProfiles.id,
    { onDelete: "set null" },
  ),
  legacySourceId: text("legacy_source_id"),
  niche: text("niche").notNull(),
  topic: text("topic").notNull(),
  angle: text("angle"),
  format: text("format").notNull().default("short"),
  hookStyle: text("hook_style").notNull().default("boldclaim"),
  tone: text("tone").notNull().default("howto"),
  contentText: text("content_text").notNull(),
  notes: text("notes"),
  performanceJson: text("performance_json").default("{}").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
