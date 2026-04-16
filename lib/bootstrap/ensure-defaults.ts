import { count, eq } from "drizzle-orm";

import { defaultCandidateProfiles } from "@/lib/candidate/default-profiles";
import { db, sqlite } from "@/lib/db/client";
import { freelancePositioningProfiles } from "@/lib/db/schema/freelance";
import {
  aiBudgetSettings,
  inboxConnections,
  platformConnections,
} from "@/lib/db/schema/integrations";
import { candidateProfiles } from "@/lib/db/schema/profiles";
import { getRuntimeEnvironmentSummary } from "@/lib/runtime/deployment";

type PlatformConnectionRecord = typeof platformConnections.$inferSelect;

const defaultPlatformConnections = [
  { platform: "company_pages", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Direct page scanning is available now." },
  { platform: "greenhouse", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Direct board ingestion foundation is available now." },
  { platform: "lever", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Direct board ingestion foundation is available now." },
  { platform: "workday", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Direct board ingestion foundation is available now." },
  { platform: "direct_urls", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Manual URLs can be imported immediately." },
  { platform: "google_jobs", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "attach", debugPort: 9222, isEnabled: false, notes: "Browser-backed collection is local-only and uses the Job Search OS profile when enabled." },
  { platform: "linkedin", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "attach", debugPort: 9222, isEnabled: false, notes: "Session-backed collection is local-only and uses the Job Search OS profile when enabled." },
  { platform: "indeed", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "attach", debugPort: 9222, isEnabled: false, notes: "Session-backed collection is local-only and uses the Job Search OS profile when enabled." },
  { platform: "upwork", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "attach", debugPort: 9222, isEnabled: false, notes: "Freelance browser automation is local-only and uses the Job Search OS profile when enabled." },
  { platform: "fiverr", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "attach", debugPort: 9222, isEnabled: false, notes: "Freelance browser automation is local-only and uses the Job Search OS profile when enabled." },
  { platform: "contra", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "attach", debugPort: 9222, isEnabled: false, notes: "Freelance marketplace review is local-only and can be layered into browser automation." },
  { platform: "toptal", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "attach", debugPort: 9222, isEnabled: false, notes: "Freelance marketplace review is local-only and can be layered into browser automation." },
];

function runSqlite(sql: string) {
  if (!sqlite) {
    return;
  }

  sqlite.prepare(sql).run();
}

function getSqliteColumnNames(tableName: string) {
  if (!sqlite) {
    return new Set<string>();
  }

  const columns = sqlite
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;
  return new Set(columns.map((column) => column.name));
}

function ensureSqliteColumns(
  tableName: string,
  columns: Array<{ name: string; sql: string }>,
) {
  const columnNames = getSqliteColumnNames(tableName);

  for (const column of columns) {
    if (!columnNames.has(column.name)) {
      runSqlite(column.sql);
    }
  }
}

function ensurePlatformConnectionColumns() {
  if (!sqlite) {
    return;
  }

  ensureSqliteColumns("platform_connections", [
    {
      name: "connection_mode",
      sql: "ALTER TABLE platform_connections ADD COLUMN connection_mode TEXT DEFAULT 'launch' NOT NULL",
    },
    {
      name: "debug_port",
      sql: "ALTER TABLE platform_connections ADD COLUMN debug_port INTEGER",
    },
  ]);
}

function ensureApplicationColumns() {
  if (!sqlite) {
    return;
  }

  ensureSqliteColumns("applications", [
    {
      name: "follow_up_required",
      sql: "ALTER TABLE applications ADD COLUMN follow_up_required INTEGER DEFAULT false NOT NULL",
    },
    {
      name: "follow_up_instructions",
      sql: "ALTER TABLE applications ADD COLUMN follow_up_instructions TEXT",
    },
  ]);
}

function ensureInboxTables() {
  if (!sqlite) {
    return;
  }

  runSqlite(
    `CREATE TABLE IF NOT EXISTS inbox_connections (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        provider text DEFAULT 'manual' NOT NULL,
        monitored_address text,
        provider_account_email text,
        forwarding_address text,
        connection_status text DEFAULT 'not_connected' NOT NULL,
        is_enabled integer DEFAULT false NOT NULL,
        auto_create_reminders integer DEFAULT true NOT NULL,
        notify_on_employer_replies integer DEFAULT true NOT NULL,
        oauth_state_token text,
        access_token text,
        refresh_token text,
        token_expires_at text,
        sync_cursor text,
        sync_query text DEFAULT 'newer_than:30d' NOT NULL,
        last_sync_started_at text,
        last_sync_completed_at text,
        last_sync_status text DEFAULT 'idle' NOT NULL,
        last_sync_error text,
        notes text,
        last_ingested_at text,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
  );

  runSqlite(
    `CREATE TABLE IF NOT EXISTS inbox_messages (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        application_id integer,
        job_id integer,
        source_provider text DEFAULT 'manual' NOT NULL,
        external_message_id text,
        thread_id text,
        sender_name text,
        sender_email text NOT NULL,
        subject text NOT NULL,
        snippet text,
        body_text text,
        received_at text NOT NULL,
        message_type text DEFAULT 'other' NOT NULL,
        matched_status text DEFAULT 'unmatched' NOT NULL,
        reviewed_at text,
        processing_notes text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
  );

  ensureSqliteColumns("inbox_connections", [
    {
      name: "provider_account_email",
      sql: "ALTER TABLE inbox_connections ADD COLUMN provider_account_email TEXT",
    },
    {
      name: "oauth_state_token",
      sql: "ALTER TABLE inbox_connections ADD COLUMN oauth_state_token TEXT",
    },
    {
      name: "access_token",
      sql: "ALTER TABLE inbox_connections ADD COLUMN access_token TEXT",
    },
    {
      name: "refresh_token",
      sql: "ALTER TABLE inbox_connections ADD COLUMN refresh_token TEXT",
    },
    {
      name: "token_expires_at",
      sql: "ALTER TABLE inbox_connections ADD COLUMN token_expires_at TEXT",
    },
    {
      name: "sync_cursor",
      sql: "ALTER TABLE inbox_connections ADD COLUMN sync_cursor TEXT",
    },
    {
      name: "sync_query",
      sql: "ALTER TABLE inbox_connections ADD COLUMN sync_query TEXT DEFAULT 'newer_than:30d' NOT NULL",
    },
    {
      name: "last_sync_started_at",
      sql: "ALTER TABLE inbox_connections ADD COLUMN last_sync_started_at TEXT",
    },
    {
      name: "last_sync_completed_at",
      sql: "ALTER TABLE inbox_connections ADD COLUMN last_sync_completed_at TEXT",
    },
    {
      name: "last_sync_status",
      sql: "ALTER TABLE inbox_connections ADD COLUMN last_sync_status TEXT DEFAULT 'idle' NOT NULL",
    },
    {
      name: "last_sync_error",
      sql: "ALTER TABLE inbox_connections ADD COLUMN last_sync_error TEXT",
    },
  ]);

  ensureSqliteColumns("inbox_messages", [
    {
      name: "thread_id",
      sql: "ALTER TABLE inbox_messages ADD COLUMN thread_id TEXT",
    },
    {
      name: "message_type",
      sql: "ALTER TABLE inbox_messages ADD COLUMN message_type TEXT DEFAULT 'other' NOT NULL",
    },
    {
      name: "reviewed_at",
      sql: "ALTER TABLE inbox_messages ADD COLUMN reviewed_at TEXT",
    },
  ]);

  runSqlite(
    "CREATE UNIQUE INDEX IF NOT EXISTS inbox_messages_provider_external_idx ON inbox_messages (source_provider, external_message_id)",
  );
}

function ensureFreelanceTables() {
  if (!sqlite) {
    return;
  }

  runSqlite(
    `CREATE TABLE IF NOT EXISTS freelance_positioning_profiles (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        name text NOT NULL,
        source_profile_id integer,
        is_default integer DEFAULT false NOT NULL,
        services_json text DEFAULT '[]' NOT NULL,
        pricing_json text DEFAULT '{}' NOT NULL,
        voice_json text DEFAULT '{}' NOT NULL,
        proof_points_json text DEFAULT '[]' NOT NULL,
        banned_claims_json text DEFAULT '[]' NOT NULL,
        platform_preferences_json text DEFAULT '{}' NOT NULL,
        notes text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
  );

  runSqlite(
    `CREATE TABLE IF NOT EXISTS freelance_niches (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        profile_id integer,
        legacy_source_id text,
        slug text NOT NULL,
        title text NOT NULL,
        demand text DEFAULT 'Medium' NOT NULL,
        rationale text NOT NULL,
        platforms_json text DEFAULT '[]' NOT NULL,
        buyer text,
        edge text,
        status text DEFAULT 'candidate' NOT NULL,
        notes text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
  );

  runSqlite(
    `CREATE TABLE IF NOT EXISTS freelance_service_listings (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        niche_id integer,
        profile_id integer,
        legacy_source_id text,
        platform text NOT NULL,
        format text DEFAULT 'generic' NOT NULL,
        title text NOT NULL,
        content_json text DEFAULT '{}' NOT NULL,
        performance_json text DEFAULT '{}' NOT NULL,
        status text DEFAULT 'active' NOT NULL,
        notes text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
  );

  runSqlite(
    `CREATE TABLE IF NOT EXISTS freelance_listing_versions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        listing_id integer NOT NULL,
        content_json text DEFAULT '{}' NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
  );

  runSqlite(
    `CREATE TABLE IF NOT EXISTS freelance_generated_drafts (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        job_id integer,
        profile_id integer,
        platform text NOT NULL,
        draft_type text DEFAULT 'proposal' NOT NULL,
        tone text DEFAULT 'balanced' NOT NULL,
        prompt_json text DEFAULT '{}' NOT NULL,
        fit_json text DEFAULT '{}' NOT NULL,
        content_text text NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
  );

  runSqlite(
    `CREATE TABLE IF NOT EXISTS freelance_social_posts (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        profile_id integer,
        legacy_source_id text,
        niche text NOT NULL,
        topic text NOT NULL,
        angle text,
        format text DEFAULT 'short' NOT NULL,
        hook_style text DEFAULT 'boldclaim' NOT NULL,
        tone text DEFAULT 'howto' NOT NULL,
        content_text text NOT NULL,
        notes text,
        performance_json text DEFAULT '{}' NOT NULL,
        status text DEFAULT 'draft' NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`,
  );

  ensureSqliteColumns("freelance_niches", [
    {
      name: "legacy_source_id",
      sql: "ALTER TABLE freelance_niches ADD COLUMN legacy_source_id TEXT",
    },
  ]);

  ensureSqliteColumns("freelance_service_listings", [
    {
      name: "legacy_source_id",
      sql: "ALTER TABLE freelance_service_listings ADD COLUMN legacy_source_id TEXT",
    },
  ]);
}

function seedFreelancePositioningProfile() {
  const existingProfiles = db
    .select({ count: count() })
    .from(freelancePositioningProfiles)
    .get();

  if (existingProfiles && existingProfiles.count > 0) {
    return;
  }

  const sourceProfile = db
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.profileType, "freelance"))
    .get() as typeof candidateProfiles.$inferSelect | undefined;

  const sourceContent = sourceProfile
    ? (JSON.parse(sourceProfile.contentJson) as {
        headline?: string;
        summary?: string;
        strengths?: string[];
      })
    : null;

  db.insert(freelancePositioningProfiles)
    .values({
      name: "Eric Tetzlaff Freelance Positioning",
      sourceProfileId: sourceProfile?.id ?? null,
      isDefault: true,
      servicesJson: JSON.stringify([
        "AI governance tools and workflow architecture for HOA/CAM software founders",
        "HOA document intelligence, OCR systems, and retrieval workflow design",
        "Property management AI workflow automation for regional operators",
        "Operations knowledge base architecture and SOP systems for service teams",
        "Property management software migration and process redesign",
        "System prompt drafting and analysis for domain-specific workflows",
        "AI agent architecture, orchestration, and decision-logic design",
        "Workflow audits, process redesign, and implementation planning",
        "Operations documentation and engineering-ready specifications",
      ]),
      pricingJson: JSON.stringify({
        hourlyRange: "$95-$175/hr",
        discoveryRange: "$300-$900",
        starterRange: "$1,500-$3,500",
        standardRange: "$3,500-$8,500",
        advancedRange: "$8,000-$25,000",
        retainers: "$1,200-$3,000/mo when the scope justifies ongoing iteration",
        packagingRules: [
          "Use fixed-scope packages for marketplaces whenever possible.",
          "Reserve higher pricing for OCR, retrieval architecture, multi-agent orchestration, or migration/process redesign work.",
          "Avoid open-ended retainers until fit is proven.",
          "Do not offer free consulting disguised as discovery.",
        ],
        notes:
          "Anchor pricing to business pain, complexity, and handoff value. Smaller marketplace offers can sit below these ranges when intentionally scoped.",
      }),
      voiceJson: JSON.stringify({
        style:
          "Practical, direct, operator-led, and specific. Confident but not arrogant. No buzzwords.",
        toneRules: [
          "Lead with the operational problem and the concrete outcome.",
          "Use real numbers and source-grounded claims.",
          "Prefer plain English over abstract transformation language.",
          "Sound like an operator who ran the work, not a consultant who observed it from the outside.",
          "Use domain detail when it helps credibility: boards, violations, governing docs, reserve studies, homeowner data, onboarding load, PM software stack.",
          "Avoid generic AI strategy language. Name the workflow, deliverable, or architecture component instead.",
          "Keep CTAs direct and low-drama.",
        ],
      }),
      proofPointsJson: JSON.stringify([
        "14+ years operations leadership",
        "Founder and President, Point 2 Point Property Management",
        "Scaled service organization to $30K+ MRR and a 7-person team",
        "Managed 2,000+ homeowners, 34 associations, and $15M+ in reserves",
        "Reduced overhead 41%",
        "Founder and Product Architect, BoardPath",
        "Built AI governance architecture, multi-stage OCR, and retrieval workflows around real HOA documents and operating data",
        "CMCA certified",
        "Hands-on experience with CINC, Vantaca, Buildium, AppFolio, Frontsteps, and Sage 50",
        "Can translate messy operational workflows into documented, engineering-ready specs",
        sourceContent?.summary,
      ].filter(Boolean)),
      bannedClaimsJson: JSON.stringify([
        "Do not claim guaranteed revenue, guaranteed placement, or guaranteed lead volume.",
        "Do not present BoardPath as a mature public company or imply customer scale you cannot support.",
        "Do not invent client logos, certifications, case studies, or software depth.",
        "Do not use hollow phrases like game-changer, passionate, excited, world-class, or revolutionary.",
        "Do not call yourself an AI generalist or strategist when the stronger claim is operator with specific domain systems experience.",
        "Do not promise enterprise implementation support if the real offer is scoped architecture, workflow design, prompt systems, or targeted builds.",
      ]),
      platformPreferencesJson: JSON.stringify({
        primaryPlatforms: ["Upwork", "Toptal", "Contra", "Fiverr", "Indeed"],
        preferredNiches: [
          "HOA/CAM AI governance tools",
          "HOA document intelligence and OCR",
          "Property management AI workflow automation",
          "Operations knowledge base architecture",
          "Property management software migration and process redesign",
        ],
        platformAngles: {
          Upwork: "Outcome-driven fixed-scope offers with concrete tiers and fast qualification.",
          Fiverr: "Tightly packaged service offers with clear deliverables and easy buyer entry.",
          Contra: "Portfolio-forward specialist positioning with architecture and implementation clarity.",
          Toptal: "Senior operator and systems architect tone for executive or product buyers.",
          Indeed: "Contract-role positioning with direct fit language and platform-specific credibility.",
        },
        phaseTwo: ["LinkedIn content generation"],
      }),
      notes:
        "Seeded from the freelance candidate profile and the generated HOA/property-management positioning drafts in Resume Info/Freelance/Generated Posts/LinkedIn.",
    })
    .run();
}

export async function ensureDefaultRecords() {
  const runtime = getRuntimeEnvironmentSummary();
  if (runtime.isHosted && runtime.database.kind !== "sqlite_file") {
    return;
  }

  const existingProfiles = db
    .select({ count: count() })
    .from(candidateProfiles)
    .get();

  if (!existingProfiles || existingProfiles.count === 0) {
    db.insert(candidateProfiles)
      .values(
        defaultCandidateProfiles.map((profile) => ({
          name: profile.name,
          profileType: profile.profileType,
          sourceDocPath: profile.sourceDocPath,
          contentJson: JSON.stringify(profile.content),
          isCanonical: profile.isCanonical,
        })),
      )
      .run();
  }

  const budgetRow = db
    .select()
    .from(aiBudgetSettings)
    .where(eq(aiBudgetSettings.id, 1))
    .get();

  if (!budgetRow) {
    db.insert(aiBudgetSettings)
      .values({
        id: 1,
        monthlyBudget: 25,
        warningThreshold: 0.8,
        hardLimitEnabled: true,
        neverAutoRunDeepAnalysis: true,
      })
      .run();
  }

  if (sqlite) {
    ensurePlatformConnectionColumns();
    ensureApplicationColumns();
    ensureInboxTables();
    ensureFreelanceTables();
  }

  seedFreelancePositioningProfile();

  const inboxConnection = db.select().from(inboxConnections).where(eq(inboxConnections.id, 1)).get();
  if (!inboxConnection) {
    db.insert(inboxConnections)
      .values({
        id: 1,
        provider: "manual",
        forwardingAddress: "job-search-inbox@local-only.invalid",
        connectionStatus: "not_connected",
        isEnabled: false,
        autoCreateReminders: true,
        notifyOnEmployerReplies: true,
        syncQuery: "newer_than:30d",
        lastSyncStatus: "idle",
        notes: "Manual inbox capture is available now. Live email access can be layered in later.",
      })
      .run();
  }

  const existingConnections = db
    .select({ count: count() })
    .from(platformConnections)
    .get();

  if (!existingConnections || existingConnections.count === 0) {
    db.insert(platformConnections).values(defaultPlatformConnections).run();
    return;
  }

  const connectionRows = db.select().from(platformConnections).all() as PlatformConnectionRecord[];

  for (const connection of defaultPlatformConnections) {
    const existingConnection = connectionRows.find(
      (row: PlatformConnectionRecord) => row.platform === connection.platform,
    );

    if (!existingConnection) {
      db.insert(platformConnections).values(connection).run();
      continue;
    }

    db.update(platformConnections)
      .set({
        browserType: existingConnection.browserType ?? connection.browserType,
        browserProfileName:
          existingConnection.browserProfileName ?? connection.browserProfileName,
        connectionMode: existingConnection.connectionMode ?? connection.connectionMode,
        debugPort: existingConnection.debugPort ?? connection.debugPort,
        notes: existingConnection.notes ?? connection.notes,
      })
      .where(eq(platformConnections.platform, connection.platform))
      .run();
  }
}
