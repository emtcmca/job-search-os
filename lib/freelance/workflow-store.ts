import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  freelanceGeneratedDrafts,
  freelanceListingVersions,
  freelanceNiches,
  freelancePositioningProfiles,
  freelanceServiceListings,
  freelanceSocialPosts,
} from "@/lib/db/schema/freelance";
import { jobSnapshots, jobs } from "@/lib/db/schema/jobs";
import { scoreFactors, scores } from "@/lib/db/schema/scoring";
import {
  discoverFreelanceNiches,
  formatProfileForPrompt,
  generateFreelanceProposal,
  generateServiceListing,
} from "@/lib/freelance/generation";
import { listFromTextarea, safeJsonParse } from "@/lib/freelance/json";
import { getPlatformKnowledge, normalizeFreelancePlatform } from "@/lib/freelance/platforms";
import {
  getFreelanceLead,
  getFreelanceNiche,
  getFreelanceProfile,
  parseFreelanceProfileMemory,
} from "@/lib/freelance/queries";

type ProfileRecord = typeof freelancePositioningProfiles.$inferSelect;

type ClaudeStorageDump = {
  fcc_apps?: Array<{
    id?: string;
    dateAdded?: string;
    title?: string;
    platform?: string;
    url?: string;
    status?: string;
    dueDate?: string;
    notes?: string;
  }>;
  fcc_niches?: Array<{
    libId?: string;
    savedAt?: string;
    notes?: string;
    title?: string;
    demand?: string;
    rationale?: string;
    platforms?: string[];
    buyer?: string;
    edge?: string;
  }>;
  fcc_listings?: Array<{
    libId?: string;
    savedAt?: string;
    nicheTitle?: string;
    nicheData?: {
      title?: string;
      demand?: string;
      rationale?: string;
      platforms?: string[];
      buyer?: string;
      edge?: string;
    };
    platform?: string;
    format?: string;
    content?: Record<string, unknown>;
    notes?: string;
    performance?: Record<string, unknown>;
    versions?: Array<{
      verId?: string;
      savedAt?: string;
      content?: Record<string, unknown>;
    }>;
  }>;
  fcc_posts?: Array<{
    libId?: string;
    savedAt?: string;
    niche?: string;
    topic?: string;
    angle?: string;
    format?: string;
    hookStyle?: string;
    postTone?: string;
    content?: string;
    notes?: string;
    performance?: Record<string, unknown> & { status?: string };
  }>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseJsonField<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function profilePrompt(profile: ProfileRecord) {
  const memory = parseFreelanceProfileMemory(profile);
  return formatProfileForPrompt({
    name: profile.name,
    services: memory.services,
    pricing: memory.pricing,
    voice: memory.voice,
    proofPoints: memory.proofPoints,
    bannedClaims: memory.bannedClaims,
    platformPreferences: memory.platformPreferences,
    notes: profile.notes,
  });
}

function mapLegacyLeadStatus(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "applied":
      return "submitted";
    case "interview":
      return "interview";
    case "won":
      return "won";
    case "lost":
      return "closed";
    default:
      return "review";
  }
}

function coerceIsoDate(value?: string) {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function deriveListingTitle(content: Record<string, unknown>) {
  if (typeof content.catalogTitle === "string") {
    return content.catalogTitle;
  }
  if (typeof content.gigTitle === "string") {
    return content.gigTitle;
  }
  if (typeof content.listingTitle === "string") {
    return content.listingTitle;
  }
  if (typeof content.profileHeadline === "string") {
    return content.profileHeadline;
  }

  return "Imported service listing";
}

export async function createFreelanceLead(input: {
  title: string;
  platform: string;
  url?: string;
  rawDescription?: string;
  notes?: string;
}) {
  const title = input.title.trim();
  const platform = normalizeFreelancePlatform(input.platform);
  const rawDescription = input.rawDescription?.trim() ?? "";
  const sourceUrl =
    input.url?.trim() ||
    `manual://freelance/${platform.toLowerCase()}/${Date.now().toString(36)}`;

  if (!title) {
    return { ok: false as const, message: "A lead title is required." };
  }

  let normalizedUrl: URL | null = null;
  if (input.url?.trim()) {
    try {
      normalizedUrl = new URL(input.url.trim());
    } catch {
      return { ok: false as const, message: "Please enter a valid absolute URL." };
    }
  }

  const dedupeKey = createHash("sha256")
    .update([title.toLowerCase(), platform.toLowerCase(), sourceUrl].join("|"))
    .digest("hex");

  const existing = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.jobType, "freelance"), eq(jobs.dedupeKey, dedupeKey)))
    .get();

  const source = getPlatformKnowledge(platform).source;
  const jobId =
    existing?.id ??
    (await db
      .insert(jobs)
      .values({
        jobType: "freelance",
        source,
        sourceUrl,
        title,
        locationType: "remote",
        employmentType: "contract",
        currency: "USD",
        currentStage: "review",
        dedupeKey,
      })
      .returning({ id: jobs.id })
      .get())?.id;

  if (!jobId) {
    return { ok: false as const, message: "The freelance lead could not be saved." };
  }

  const snapshotText = [
    rawDescription,
    input.notes?.trim() ? `Notes: ${input.notes.trim()}` : "",
    normalizedUrl ? `URL: ${normalizedUrl.toString()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const snapshotHash = createHash("sha256")
    .update([sourceUrl, snapshotText].join("|"))
    .digest("hex");
  const existingSnapshot = await db
    .select()
    .from(jobSnapshots)
    .where(and(eq(jobSnapshots.jobId, jobId), eq(jobSnapshots.snapshotHash, snapshotHash)))
    .get();

  if (!existingSnapshot) {
    await db
      .insert(jobSnapshots)
      .values({
        jobId,
        snapshotHash,
        rawText: snapshotText,
        parsedJson: JSON.stringify({ platform, source, notes: input.notes ?? null }),
      })
      .run();
  }

  return {
    ok: true as const,
    jobId,
    message: existing ? "Freelance lead refreshed." : "Freelance lead saved.",
  };
}

export async function updateFreelanceLeadStage(input: { jobId: number; stage: string }) {
  if (!Number.isFinite(input.jobId) || !input.stage.trim()) {
    return { ok: false as const, message: "Unable to update the freelance lead." };
  }

  await db
    .update(jobs)
    .set({ currentStage: input.stage, updatedAt: new Date().toISOString() })
    .where(eq(jobs.id, input.jobId))
    .run();

  return { ok: true as const, message: "Freelance lead updated." };
}

export async function updateFreelanceProfile(input: {
  profileId: number;
  name: string;
  servicesText: string;
  pricingJson: string;
  voiceJson: string;
  proofPointsText: string;
  bannedClaimsText: string;
  platformPreferencesJson: string;
  notes: string;
}) {
  const pricing = parseJsonField(input.pricingJson, null);
  const voice = parseJsonField(input.voiceJson, null);
  const platformPreferences = parseJsonField(input.platformPreferencesJson, null);

  if (!input.name.trim()) {
    return { ok: false as const, message: "Profile name is required." };
  }

  if (!pricing || !voice || !platformPreferences) {
    return {
      ok: false as const,
      message: "Pricing, voice, and platform preferences must be valid JSON.",
    };
  }

  await db
    .update(freelancePositioningProfiles)
    .set({
      name: input.name.trim(),
      servicesJson: JSON.stringify(listFromTextarea(input.servicesText)),
      pricingJson: JSON.stringify(pricing),
      voiceJson: JSON.stringify(voice),
      proofPointsJson: JSON.stringify(listFromTextarea(input.proofPointsText)),
      bannedClaimsJson: JSON.stringify(listFromTextarea(input.bannedClaimsText)),
      platformPreferencesJson: JSON.stringify(platformPreferences),
      notes: input.notes.trim() || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(freelancePositioningProfiles.id, input.profileId))
    .run();

  return { ok: true as const, message: "Freelance positioning memory updated." };
}

export async function createFreelanceProfile(input: {
  name: string;
  sourceProfileId?: number | null;
}) {
  const name = input.name.trim();
  if (!name) {
    return { ok: false as const, message: "Profile name is required." };
  }

  const defaultProfile = await getFreelanceProfile();
  const memory = defaultProfile ? parseFreelanceProfileMemory(defaultProfile) : null;

  await db
    .insert(freelancePositioningProfiles)
    .values({
      name,
      sourceProfileId: input.sourceProfileId ?? defaultProfile?.sourceProfileId ?? null,
      isDefault: false,
      servicesJson: JSON.stringify(memory?.services ?? []),
      pricingJson: JSON.stringify(memory?.pricing ?? {}),
      voiceJson: JSON.stringify(memory?.voice ?? {}),
      proofPointsJson: JSON.stringify(memory?.proofPoints ?? []),
      bannedClaimsJson: JSON.stringify(memory?.bannedClaims ?? []),
      platformPreferencesJson: JSON.stringify(memory?.platformPreferences ?? {}),
      notes: "Created from the current default freelance memory.",
    })
    .run();

  return { ok: true as const, message: "New freelance profile created." };
}

export async function runNicheDiscovery(profileId?: number | null) {
  const profile = await getFreelanceProfile(profileId);
  if (!profile) {
    return { ok: false as const, message: "No freelance positioning profile exists yet." };
  }

  const payload = await discoverFreelanceNiches(profilePrompt(profile));
  let savedCount = 0;

  for (const niche of payload.niches) {
    const slug = slugify(niche.id || niche.title);
    const existing = await db
      .select()
      .from(freelanceNiches)
      .where(and(eq(freelanceNiches.profileId, profile.id), eq(freelanceNiches.slug, slug)))
      .get();

    const values = {
      profileId: profile.id,
      slug,
      title: niche.title,
      demand: niche.demand,
      rationale: niche.rationale,
      platformsJson: JSON.stringify(niche.platforms),
      buyer: niche.buyer,
      edge: niche.edge,
      status: "candidate",
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await db.update(freelanceNiches).set(values).where(eq(freelanceNiches.id, existing.id)).run();
    } else {
      await db.insert(freelanceNiches).values(values).run();
      savedCount += 1;
    }
  }

  return {
    ok: true as const,
    message:
      savedCount > 0
        ? `Discovered ${payload.niches.length} niches and saved ${savedCount} new candidates.`
        : `Refreshed ${payload.niches.length} existing niche candidates.`,
  };
}

export async function updateFreelanceNiche(input: {
  nicheId: number;
  status: string;
  notes: string;
}) {
  if (!Number.isFinite(input.nicheId)) {
    return { ok: false as const, message: "Unable to update the niche." };
  }

  await db
    .update(freelanceNiches)
    .set({
      status: input.status,
      notes: input.notes.trim() || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(freelanceNiches.id, input.nicheId))
    .run();

  return { ok: true as const, message: "Niche updated." };
}

export async function buildServiceListing(input: {
  nicheId: number;
  platform: string;
  profileId?: number | null;
}) {
  const niche = await getFreelanceNiche(input.nicheId);
  if (!niche) {
    return { ok: false as const, message: "Niche not found." };
  }

  const profile = await getFreelanceProfile(input.profileId ?? niche.profileId);
  if (!profile) {
    return { ok: false as const, message: "No freelance positioning profile exists yet." };
  }

  const platform = normalizeFreelancePlatform(input.platform);
  const content = await generateServiceListing({
    profilePrompt: profilePrompt(profile),
    platform,
    niche: {
      title: niche.title,
      buyer: niche.buyer,
      edge: niche.edge,
      rationale: niche.rationale,
    },
  });
  const contentJson = JSON.stringify(content);
  const format = getPlatformKnowledge(platform).format;
  const title =
    "catalogTitle" in content
      ? content.catalogTitle
      : "gigTitle" in content
        ? content.gigTitle
        : content.listingTitle;
  const existing = await db
    .select()
    .from(freelanceServiceListings)
    .where(
      and(
        eq(freelanceServiceListings.nicheId, niche.id),
        eq(freelanceServiceListings.platform, platform),
      ),
    )
    .get();

  if (existing) {
    await db
      .insert(freelanceListingVersions)
      .values({
        listingId: existing.id,
        contentJson: existing.contentJson,
      })
      .run();
    await db
      .update(freelanceServiceListings)
      .set({
        profileId: profile.id,
        format,
        title,
        contentJson,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(freelanceServiceListings.id, existing.id))
      .run();
  } else {
    await db
      .insert(freelanceServiceListings)
      .values({
        nicheId: niche.id,
        profileId: profile.id,
        platform,
        format,
        title,
        contentJson,
        performanceJson: JSON.stringify({
          leads: 0,
          inquiries: 0,
          conversions: 0,
          rating: 0,
        }),
        status: "active",
      })
      .run();
  }

  return {
    ok: true as const,
    message: existing ? "Service listing regenerated and versioned." : "Service listing generated.",
  };
}

export async function updateServiceListing(input: {
  listingId: number;
  status: string;
  notes: string;
  performanceJson: string;
}) {
  const performance = parseJsonField(input.performanceJson, null);
  if (!performance) {
    return { ok: false as const, message: "Performance data must be valid JSON." };
  }

  await db
    .update(freelanceServiceListings)
    .set({
      status: input.status,
      notes: input.notes.trim() || null,
      performanceJson: JSON.stringify(performance),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(freelanceServiceListings.id, input.listingId))
    .run();

  return { ok: true as const, message: "Service listing updated." };
}

export async function runProposalGeneration(input: {
  jobId: number;
  platform: string;
  tone: string;
  profileId?: number | null;
}) {
  const detail = await getFreelanceLead(input.jobId);
  if (!detail) {
    return { ok: false as const, message: "Freelance lead not found." };
  }

  const profile = await getFreelanceProfile(input.profileId);
  if (!profile) {
    return { ok: false as const, message: "No freelance positioning profile exists yet." };
  }

  const listingText =
    detail.snapshot?.rawText?.trim() ||
    [detail.lead.title, detail.lead.sourceUrl].filter(Boolean).join("\n");
  const platform = normalizeFreelancePlatform(input.platform);
  const payload = await generateFreelanceProposal({
    profilePrompt: profilePrompt(profile),
    platform,
    listingText,
    tone: input.tone,
    jobId: detail.lead.id,
  });

  const scoreId = (await db
    .insert(scores)
    .values({
      jobId: detail.lead.id,
      snapshotId: detail.snapshot?.id ?? null,
      tier: "freelance_ai",
      overallScore: payload.fit.score,
      recommendation: payload.fit.pursue
        ? payload.fit.verdict === "Strong Fit"
          ? "tailor"
          : "review"
        : "skip",
      recommendedResumeType: "freelance",
      deepReviewRecommended: false,
      deepReviewReason: null,
      summary: `${payload.fit.verdict}: ${payload.fit.angle}`,
      reasonsForJson: JSON.stringify(payload.fit.strengths),
      reasonsAgainstJson: JSON.stringify(payload.fit.gaps),
    })
    .returning({ id: scores.id })
    .get())?.id;

  if (scoreId) {
    await db
      .insert(scoreFactors)
      .values([
        ...payload.fit.strengths.map((reason, index) => ({
          scoreId,
          factorKey: `freelance_positive_${index + 1}`,
          factorLabel: "Freelance fit signal",
          weight: 1,
          value: 1,
          explanation: reason,
        })),
        ...payload.fit.gaps.map((reason, index) => ({
          scoreId,
          factorKey: `freelance_gap_${index + 1}`,
          factorLabel: "Freelance gap",
          weight: -1,
          value: -1,
          explanation: reason,
        })),
      ])
      .run();
  }

  await db
    .insert(freelanceGeneratedDrafts)
    .values({
      jobId: detail.lead.id,
      profileId: profile.id,
      platform,
      draftType: "proposal",
      tone: input.tone,
      promptJson: JSON.stringify({
        platform,
        tone: input.tone,
        profileId: profile.id,
      }),
      fitJson: JSON.stringify(payload.fit),
      contentText: payload.proposal,
    })
    .run();

  await db
    .update(jobs)
    .set({
      currentStage: payload.fit.pursue ? "tailoring" : "closed",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(jobs.id, detail.lead.id))
    .run();

  return {
    ok: true as const,
    message: "Freelance fit analysis and proposal draft generated.",
  };
}

export function readListingContent(raw: string) {
  return safeJsonParse<Record<string, unknown>>(raw, {});
}

export async function importClaudeStorageDump(input: {
  rawDump: string;
  profileId?: number | null;
}) {
  const parsed = parseJsonField<ClaudeStorageDump | null>(input.rawDump, null);
  if (!parsed) {
    return { ok: false as const, message: "The Claude storage export is not valid JSON." };
  }

  const profile = await getFreelanceProfile(input.profileId);
  if (!profile) {
    return { ok: false as const, message: "No freelance positioning profile exists yet." };
  }

  const imported = {
    leads: 0,
    niches: 0,
    listings: 0,
    listingVersions: 0,
    posts: 0,
  };

  const nicheIdsByLegacyId = new Map<string, number>();
  const nicheIdsByTitle = new Map<string, number>();

  const existingNiches = await db.select().from(freelanceNiches).all();
  for (const niche of existingNiches) {
    nicheIdsByTitle.set(niche.title.trim().toLowerCase(), niche.id);
    if (niche.legacySourceId) {
      nicheIdsByLegacyId.set(niche.legacySourceId, niche.id);
    }
  }

  for (const niche of parsed.fcc_niches ?? []) {
    if (!niche.title?.trim()) {
      continue;
    }

    const legacyId = niche.libId?.trim() || null;
    const titleKey = niche.title.trim().toLowerCase();
    const existingId = (legacyId ? nicheIdsByLegacyId.get(legacyId) : null) ?? nicheIdsByTitle.get(titleKey);
    const values = {
      profileId: profile.id,
      legacySourceId: legacyId,
      slug: slugify(niche.title),
      title: niche.title.trim(),
      demand:
        niche.demand === "High" || niche.demand === "Medium" || niche.demand === "Niche"
          ? niche.demand
          : "Medium",
      rationale: niche.rationale?.trim() || "Imported from Claude storage.",
      platformsJson: JSON.stringify(niche.platforms ?? []),
      buyer: niche.buyer?.trim() || null,
      edge: niche.edge?.trim() || null,
      status: "saved",
      notes: niche.notes?.trim() || null,
      createdAt: coerceIsoDate(niche.savedAt) ?? new Date().toISOString(),
      updatedAt: coerceIsoDate(niche.savedAt) ?? new Date().toISOString(),
    };

    if (existingId) {
      await db.update(freelanceNiches).set(values).where(eq(freelanceNiches.id, existingId)).run();
      if (legacyId) {
        nicheIdsByLegacyId.set(legacyId, existingId);
      }
      nicheIdsByTitle.set(titleKey, existingId);
    } else {
      const inserted = await db
        .insert(freelanceNiches)
        .values(values)
        .returning({ id: freelanceNiches.id })
        .get();
      const nicheId = inserted?.id;
      if (nicheId) {
        imported.niches += 1;
        if (legacyId) {
          nicheIdsByLegacyId.set(legacyId, nicheId);
        }
        nicheIdsByTitle.set(titleKey, nicheId);
      }
    }
  }

  for (const app of parsed.fcc_apps ?? []) {
    if (!app.title?.trim()) {
      continue;
    }

    const platform = normalizeFreelancePlatform(app.platform ?? "Upwork");
    const source = getPlatformKnowledge(platform).source;
    const sourceJobId = app.id?.trim() || null;
    const dedupeKey = createHash("sha256")
      .update(
        [
          app.title.trim().toLowerCase(),
          platform.toLowerCase(),
          (app.url?.trim() || sourceJobId || app.dateAdded || "").toLowerCase(),
        ].join("|"),
      )
      .digest("hex");

    const existing =
      (sourceJobId
        ? await db
            .select()
            .from(jobs)
            .where(
              and(
                eq(jobs.jobType, "freelance"),
                eq(jobs.source, source),
                eq(jobs.sourceJobId, sourceJobId),
              ),
            )
            .get()
        : null) ??
      (await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.jobType, "freelance"), eq(jobs.dedupeKey, dedupeKey)))
        .get());

    const sourceUrl =
      app.url?.trim() || `import://claude/${platform.toLowerCase()}/${sourceJobId ?? dedupeKey}`;
    const createdAt = coerceIsoDate(app.dateAdded) ?? new Date().toISOString();
    const jobValues = {
      jobType: "freelance" as const,
      source,
      sourceJobId,
      sourceUrl,
      title: app.title.trim(),
      locationType: "remote",
      employmentType: "contract",
      currency: "USD",
      currentStage: mapLegacyLeadStatus(app.status),
      dedupeKey,
      discoveredAt: createdAt,
      updatedAt: createdAt,
    };

    const jobId =
      existing?.id ??
      (await db
        .insert(jobs)
        .values(jobValues)
        .returning({ id: jobs.id })
        .get())?.id;

    if (!existing && jobId) {
      imported.leads += 1;
    } else if (existing) {
      await db.update(jobs).set(jobValues).where(eq(jobs.id, existing.id)).run();
    }

    if (!jobId) {
      continue;
    }

    const snapshotText = [
      app.notes?.trim() ? `Notes: ${app.notes.trim()}` : "",
      app.dueDate?.trim() ? `Due date: ${app.dueDate.trim()}` : "",
      app.url?.trim() ? `URL: ${app.url.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (snapshotText) {
      const snapshotHash = createHash("sha256")
        .update([sourceUrl, snapshotText].join("|"))
        .digest("hex");
      const existingSnapshot = await db
        .select()
        .from(jobSnapshots)
        .where(and(eq(jobSnapshots.jobId, jobId), eq(jobSnapshots.snapshotHash, snapshotHash)))
        .get();
      if (!existingSnapshot) {
        await db
          .insert(jobSnapshots)
          .values({
            jobId,
            snapshotHash,
            rawText: snapshotText,
            parsedJson: JSON.stringify({
              importedFrom: "claude_storage",
              legacyStatus: app.status ?? null,
              dueDate: app.dueDate ?? null,
            }),
            capturedAt: createdAt,
          })
          .run();
      }
    }
  }

  for (const listing of parsed.fcc_listings ?? []) {
    const content = listing.content ?? {};
    const legacyId = listing.libId?.trim() || null;
    const nicheId =
      (listing.nicheData?.title
        ? nicheIdsByTitle.get(listing.nicheData.title.trim().toLowerCase())
        : null) ??
      (listing.nicheTitle ? nicheIdsByTitle.get(listing.nicheTitle.trim().toLowerCase()) : null) ??
      null;
    const platform = normalizeFreelancePlatform(listing.platform ?? "Upwork");
    const format =
      listing.format?.trim() || getPlatformKnowledge(platform).format || "generic";
    const title = deriveListingTitle(content);
    const savedAt = coerceIsoDate(listing.savedAt) ?? new Date().toISOString();
    const existing =
      (legacyId
        ? await db
            .select()
            .from(freelanceServiceListings)
            .where(eq(freelanceServiceListings.legacySourceId, legacyId))
            .get()
        : null) ??
      (nicheId
        ? await db
            .select()
            .from(freelanceServiceListings)
            .where(
              and(
                eq(freelanceServiceListings.nicheId, nicheId),
                eq(freelanceServiceListings.platform, platform),
              ),
            )
            .get()
        : null);

    const values = {
      nicheId,
      profileId: profile.id,
      legacySourceId: legacyId,
      platform,
      format,
      title,
      contentJson: JSON.stringify(content),
      performanceJson: JSON.stringify(listing.performance ?? {}),
      status:
        typeof listing.performance?.status === "string"
          ? String(listing.performance.status).toLowerCase()
          : "active",
      notes: listing.notes?.trim() || null,
      createdAt: savedAt,
      updatedAt: savedAt,
    };

    const listingId =
      existing?.id ??
      (await db
        .insert(freelanceServiceListings)
        .values(values)
        .returning({ id: freelanceServiceListings.id })
        .get())?.id;

    if (!existing && listingId) {
      imported.listings += 1;
    } else if (existing) {
      await db
        .update(freelanceServiceListings)
        .set(values)
        .where(eq(freelanceServiceListings.id, existing.id))
        .run();
    }

    if (!listingId) {
      continue;
    }

    for (const version of listing.versions ?? []) {
      if (!version.content) {
        continue;
      }

      const contentJson = JSON.stringify(version.content);
      const existingVersion = await db
        .select()
        .from(freelanceListingVersions)
        .where(
          and(
            eq(freelanceListingVersions.listingId, listingId),
            eq(freelanceListingVersions.contentJson, contentJson),
          ),
        )
        .get();

      if (!existingVersion) {
        await db
          .insert(freelanceListingVersions)
          .values({
            listingId,
            contentJson,
            createdAt: coerceIsoDate(version.savedAt) ?? savedAt,
          })
          .run();
        imported.listingVersions += 1;
      }
    }
  }

  for (const post of parsed.fcc_posts ?? []) {
    if (!post.content?.trim()) {
      continue;
    }

    const legacyId = post.libId?.trim() || null;
    const existing = legacyId
      ? await db
          .select()
          .from(freelanceSocialPosts)
          .where(eq(freelanceSocialPosts.legacySourceId, legacyId))
          .get()
      : null;
    const createdAt = coerceIsoDate(post.savedAt) ?? new Date().toISOString();
    const values = {
      profileId: profile.id,
      legacySourceId: legacyId,
      niche: post.niche?.trim() || "Imported niche",
      topic: post.topic?.trim() || "Imported topic",
      angle: post.angle?.trim() || null,
      format: post.format?.trim() || "short",
      hookStyle: post.hookStyle?.trim() || "boldclaim",
      tone: post.postTone?.trim() || "howto",
      contentText: post.content.trim(),
      notes: post.notes?.trim() || null,
      performanceJson: JSON.stringify(post.performance ?? {}),
      status:
        typeof post.performance?.status === "string"
          ? String(post.performance.status).toLowerCase()
          : "draft",
      createdAt,
      updatedAt: createdAt,
    };

    if (existing) {
      await db
        .update(freelanceSocialPosts)
        .set(values)
        .where(eq(freelanceSocialPosts.id, existing.id))
        .run();
    } else {
      await db.insert(freelanceSocialPosts).values(values).run();
      imported.posts += 1;
    }
  }

  return {
    ok: true as const,
    message: `Imported ${imported.leads} leads, ${imported.niches} niches, ${imported.listings} listings, ${imported.listingVersions} listing versions, and ${imported.posts} saved posts from Claude storage.`,
  };
}
