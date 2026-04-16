import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  freelanceGeneratedDrafts,
  freelanceListingVersions,
  freelanceNiches,
  freelancePositioningProfiles,
  freelanceServiceListings,
} from "@/lib/db/schema/freelance";
import { jobSnapshots, jobs } from "@/lib/db/schema/jobs";
import { scores } from "@/lib/db/schema/scoring";
import { reminders } from "@/lib/db/schema/workflow";
import { safeJsonParse } from "@/lib/freelance/json";

export type FreelanceProfileRecord = typeof freelancePositioningProfiles.$inferSelect;
export type FreelanceNicheRecord = typeof freelanceNiches.$inferSelect;
export type FreelanceListingRecord = typeof freelanceServiceListings.$inferSelect;
export type FreelanceDraftRecord = typeof freelanceGeneratedDrafts.$inferSelect;
export type FreelanceListingVersionRecord = typeof freelanceListingVersions.$inferSelect;
export type FreelanceLeadRecord = typeof jobs.$inferSelect & {
  score: typeof scores.$inferSelect | null;
  openReminderCount: number;
  draftCount: number;
};

export type FreelanceProfileMemory = {
  services: string[];
  pricing: Record<string, unknown>;
  voice: Record<string, unknown>;
  proofPoints: string[];
  bannedClaims: string[];
  platformPreferences: Record<string, unknown>;
};

export type FreelanceDashboard = {
  profiles: FreelanceProfileRecord[];
  defaultProfile: FreelanceProfileRecord | null;
  leads: FreelanceLeadRecord[];
  niches: FreelanceNicheRecord[];
  listings: Array<
    FreelanceListingRecord & {
      versionCount: number;
      niche: FreelanceNicheRecord | null;
    }
  >;
  recentDrafts: FreelanceDraftRecord[];
};

export function parseFreelanceProfileMemory(profile: FreelanceProfileRecord) {
  return {
    services: safeJsonParse<string[]>(profile.servicesJson, []),
    pricing: safeJsonParse<Record<string, unknown>>(profile.pricingJson, {}),
    voice: safeJsonParse<Record<string, unknown>>(profile.voiceJson, {}),
    proofPoints: safeJsonParse<string[]>(profile.proofPointsJson, []),
    bannedClaims: safeJsonParse<string[]>(profile.bannedClaimsJson, []),
    platformPreferences: safeJsonParse<Record<string, unknown>>(
      profile.platformPreferencesJson,
      {},
    ),
  } satisfies FreelanceProfileMemory;
}

export async function listFreelanceProfiles() {
  return (await db
    .select()
    .from(freelancePositioningProfiles)
    .orderBy(desc(freelancePositioningProfiles.isDefault), freelancePositioningProfiles.name)
    .all()) as FreelanceProfileRecord[];
}

export async function getFreelanceProfile(profileId?: number | null) {
  if (profileId && Number.isFinite(profileId)) {
    const profile = (await db
      .select()
      .from(freelancePositioningProfiles)
      .where(eq(freelancePositioningProfiles.id, profileId))
      .get()) as FreelanceProfileRecord | undefined;
    if (profile) {
      return profile;
    }
  }

  const profiles = await listFreelanceProfiles();
  return profiles.find((profile) => profile.isDefault) ?? profiles[0] ?? null;
}

export async function listFreelanceLeads() {
  const leadRows = (await db
    .select()
    .from(jobs)
    .where(eq(jobs.jobType, "freelance"))
    .orderBy(desc(jobs.discoveredAt))
    .all()) as Array<typeof jobs.$inferSelect>;
  const leadIds = leadRows.map((lead) => lead.id);

  const scoreRows = leadIds.length
    ? ((await db
        .select()
        .from(scores)
        .where(inArray(scores.jobId, leadIds))
        .orderBy(desc(scores.analyzedAt))
        .all()) as Array<typeof scores.$inferSelect>)
    : [];
  const reminderRows = leadIds.length
    ? ((await db
        .select()
        .from(reminders)
        .where(inArray(reminders.jobId, leadIds))
        .all()) as Array<typeof reminders.$inferSelect>)
    : [];
  const draftRows = leadIds.length
    ? ((await db
        .select()
        .from(freelanceGeneratedDrafts)
        .where(inArray(freelanceGeneratedDrafts.jobId, leadIds))
        .all()) as FreelanceDraftRecord[])
    : [];

  const latestScores = new Map<number, (typeof scoreRows)[number]>();
  for (const score of scoreRows) {
    if (!latestScores.has(score.jobId)) {
      latestScores.set(score.jobId, score);
    }
  }

  const reminderCounts = new Map<number, number>();
  for (const reminder of reminderRows) {
    if (reminder.jobId && reminder.status === "open") {
      reminderCounts.set(reminder.jobId, (reminderCounts.get(reminder.jobId) ?? 0) + 1);
    }
  }

  const draftCounts = new Map<number, number>();
  for (const draft of draftRows) {
    if (draft.jobId) {
      draftCounts.set(draft.jobId, (draftCounts.get(draft.jobId) ?? 0) + 1);
    }
  }

  return leadRows.map((lead) => ({
    ...lead,
    score: latestScores.get(lead.id) ?? null,
    openReminderCount: reminderCounts.get(lead.id) ?? 0,
    draftCount: draftCounts.get(lead.id) ?? 0,
  })) satisfies FreelanceLeadRecord[];
}

export async function getFreelanceLead(jobId: number) {
  const lead = (await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .get()) as typeof jobs.$inferSelect | undefined;

  if (!lead || lead.jobType !== "freelance") {
    return null;
  }

  const snapshot = (await db
    .select()
    .from(jobSnapshots)
    .where(eq(jobSnapshots.jobId, jobId))
    .orderBy(desc(jobSnapshots.capturedAt))
    .get()) as typeof jobSnapshots.$inferSelect | undefined;
  const leadScores = (await db
    .select()
    .from(scores)
    .where(eq(scores.jobId, jobId))
    .orderBy(desc(scores.analyzedAt))
    .all()) as Array<typeof scores.$inferSelect>;
  const drafts = (await db
    .select()
    .from(freelanceGeneratedDrafts)
    .where(eq(freelanceGeneratedDrafts.jobId, jobId))
    .orderBy(desc(freelanceGeneratedDrafts.createdAt))
    .all()) as FreelanceDraftRecord[];

  return {
    lead,
    snapshot: snapshot ?? null,
    score: leadScores[0] ?? null,
    scores: leadScores,
    drafts,
  };
}

export async function listFreelanceNiches() {
  return (await db
    .select()
    .from(freelanceNiches)
    .orderBy(desc(freelanceNiches.createdAt))
    .all()) as FreelanceNicheRecord[];
}

export async function getFreelanceNiche(nicheId: number) {
  return (await db
    .select()
    .from(freelanceNiches)
    .where(eq(freelanceNiches.id, nicheId))
    .get()) as FreelanceNicheRecord | undefined;
}

export async function listFreelanceListings() {
  const listings = (await db
    .select()
    .from(freelanceServiceListings)
    .orderBy(desc(freelanceServiceListings.updatedAt))
    .all()) as FreelanceListingRecord[];
  const listingIds = listings.map((listing) => listing.id);
  const nicheIds = listings.map((listing) => listing.nicheId).filter(Boolean) as number[];

  const versionRows = listingIds.length
    ? ((await db
        .select()
        .from(freelanceListingVersions)
        .where(inArray(freelanceListingVersions.listingId, listingIds))
        .all()) as FreelanceListingVersionRecord[])
    : [];
  const nicheRows = nicheIds.length
    ? ((await db
        .select()
        .from(freelanceNiches)
        .where(inArray(freelanceNiches.id, nicheIds))
        .all()) as FreelanceNicheRecord[])
    : [];

  const versionCounts = new Map<number, number>();
  for (const version of versionRows) {
    versionCounts.set(version.listingId, (versionCounts.get(version.listingId) ?? 0) + 1);
  }

  const nichesById = new Map(nicheRows.map((niche) => [niche.id, niche]));

  return listings.map((listing) => ({
    ...listing,
    versionCount: versionCounts.get(listing.id) ?? 0,
    niche: listing.nicheId ? nichesById.get(listing.nicheId) ?? null : null,
  }));
}

export async function getFreelanceDashboard(): Promise<FreelanceDashboard> {
  const [profiles, leads, niches, listings, recentDrafts] = await Promise.all([
    listFreelanceProfiles(),
    listFreelanceLeads(),
    listFreelanceNiches(),
    listFreelanceListings(),
    db
      .select()
      .from(freelanceGeneratedDrafts)
      .orderBy(desc(freelanceGeneratedDrafts.createdAt))
      .limit(5)
      .all() as Promise<FreelanceDraftRecord[]>,
  ]);

  return {
    profiles,
    defaultProfile: profiles.find((profile) => profile.isDefault) ?? profiles[0] ?? null,
    leads,
    niches,
    listings,
    recentDrafts,
  };
}
