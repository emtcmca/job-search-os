import { count, eq } from "drizzle-orm";

import { defaultCandidateProfiles } from "@/lib/candidate/default-profiles";
import { db } from "@/lib/db/client";
import { aiBudgetSettings, platformConnections } from "@/lib/db/schema/integrations";
import { candidateProfiles } from "@/lib/db/schema/profiles";

const defaultPlatformConnections = [
  { platform: "company_pages", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Direct page scanning is available now." },
  { platform: "greenhouse", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Direct board ingestion foundation is available now." },
  { platform: "lever", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Direct board ingestion foundation is available now." },
  { platform: "workday", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Direct board ingestion foundation is available now." },
  { platform: "direct_urls", browserType: null, browserProfileName: null, connectionMode: "launch", debugPort: null, isEnabled: true, notes: "Manual URLs can be imported immediately." },
  { platform: "google_jobs", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "launch", debugPort: 9222, isEnabled: false, notes: "Browser-assisted automation prep only for now." },
  { platform: "linkedin", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "launch", debugPort: 9222, isEnabled: false, notes: "Session-backed automation prep only for now." },
  { platform: "indeed", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "launch", debugPort: 9222, isEnabled: false, notes: "Session-backed automation prep only for now." },
  { platform: "upwork", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "launch", debugPort: 9222, isEnabled: false, notes: "Freelance session-backed automation prep only for now." },
  { platform: "fiverr", browserType: "chrome", browserProfileName: "Job Search OS", connectionMode: "launch", debugPort: 9222, isEnabled: false, notes: "Freelance session-backed automation prep only for now." },
];

export async function ensureDefaultRecords() {
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

  const existingConnections = db
    .select({ count: count() })
    .from(platformConnections)
    .get();

  if (!existingConnections || existingConnections.count === 0) {
    db.insert(platformConnections).values(defaultPlatformConnections).run();
    return;
  }

  for (const connection of defaultPlatformConnections) {
    db.update(platformConnections)
      .set({
        connectionMode: connection.connectionMode,
        debugPort: connection.debugPort,
      })
      .where(eq(platformConnections.platform, connection.platform))
      .run();
  }
}
