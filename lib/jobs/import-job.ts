import { createHash } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { companies } from "@/lib/db/schema/companies";
import { jobSnapshots, jobs } from "@/lib/db/schema/jobs";
import { scoreFactors, scores } from "@/lib/db/schema/scoring";
import { inferJobFieldsFromText } from "@/lib/jobs/parse-job";
import { getJobSourcePriority } from "@/lib/jobs/source-preference";
import { scoreJobTier0 } from "@/lib/jobs/tier0-score";

type CompanyRecord = typeof companies.$inferSelect;
type JobRecord = typeof jobs.$inferSelect;

type ImportJobInput = {
  url: string;
  manualTitle?: string;
  manualCompany?: string;
  manualLocation?: string;
  rawDescription?: string;
};

function classifySource(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (normalized.includes("linkedin")) return "linkedin";
  if (normalized.includes("indeed")) return "indeed";
  if (normalized.includes("greenhouse")) return "greenhouse";
  if (normalized.includes("lever")) return "lever";
  if (normalized.includes("workday")) return "workday";
  if (normalized.includes("upwork")) return "upwork";
  if (normalized.includes("fiverr")) return "fiverr";

  return normalized;
}

async function tryFetchJobPage(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        html: null,
        warning: `Unable to fetch the page automatically (${response.status}). Manual details were used if provided.`,
      };
    }

    return {
      html: await response.text(),
      warning: null,
    };
  } catch {
    return {
      html: null,
      warning: "The page could not be fetched automatically. Manual details were used if provided.",
    };
  }
}

export async function importJob(input: ImportJobInput) {
  const url = input.url.trim();
  if (!url) {
    return { ok: false as const, message: "A job URL is required." };
  }

  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(url);
  } catch {
    return { ok: false as const, message: "Please enter a valid absolute URL." };
  }

  const normalizedSource = classifySource(normalizedUrl.hostname);
  const fetched = await tryFetchJobPage(normalizedUrl.toString());
  const parsed = inferJobFieldsFromText({
    url: normalizedUrl.toString(),
    html: fetched.html,
    rawDescription: input.rawDescription ?? null,
    manualTitle: input.manualTitle ?? null,
    manualCompany: input.manualCompany ?? null,
    manualLocation: input.manualLocation ?? null,
  });

  if (!parsed.title && !parsed.rawText) {
    return {
      ok: false as const,
      message:
        "The job page could not be parsed and no manual details were provided. Add at least a title or description.",
    };
  }

  const companyName = parsed.company;
  let companyId: number | null = null;
  if (companyName) {
    const existingCompany = (await db
      .select()
      .from(companies)
      .where(eq(companies.name, companyName))
      .get()) as CompanyRecord | undefined;

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const insertedCompany = await db
        .insert(companies)
        .values({
          name: companyName,
          website: normalizedUrl.origin,
        })
        .returning({ id: companies.id })
      .get();
      companyId = insertedCompany?.id ?? null;
    }
  }

  const dedupeKey = createHash("sha256")
    .update(
      [
        parsed.title.toLowerCase(),
        companyName?.toLowerCase() ?? normalizedUrl.hostname,
        (parsed.locationText ?? "").toLowerCase(),
      ].join("|"),
    )
    .digest("hex");

  const matchingSourceJob = (await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.dedupeKey, dedupeKey), eq(jobs.sourceUrl, normalizedUrl.toString())))
    .get()) as JobRecord | undefined;
  const duplicateMatches = matchingSourceJob
    ? [matchingSourceJob]
    : ((await db.select().from(jobs).where(eq(jobs.dedupeKey, dedupeKey)).all()) as JobRecord[]);
  const existingJob =
    matchingSourceJob ??
    duplicateMatches.sort((left: JobRecord, right: JobRecord) => {
      const priorityDelta =
        getJobSourcePriority(right.source) - getJobSourcePriority(left.source);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.discoveredAt.localeCompare(right.discoveredAt);
    })[0] ??
    null;
  const dedupeMerged = Boolean(existingJob && !matchingSourceJob);

  const rawText = parsed.rawText || input.rawDescription?.trim() || "";
  const snapshotHash = createHash("sha256")
    .update([normalizedUrl.toString(), rawText].join("|"))
    .digest("hex");

  const scoring = scoreJobTier0({
    title: parsed.title,
    company: companyName,
    locationText: parsed.locationText,
    locationType: parsed.locationType,
    employmentType: parsed.employmentType,
    salaryMin: parsed.salaryMin,
    salaryMax: parsed.salaryMax,
    rawText,
  });
  const shouldPromoteSource =
    !existingJob ||
    getJobSourcePriority(normalizedSource) > getJobSourcePriority(existingJob.source);

  const jobId =
    existingJob?.id ??
    (await db
      .insert(jobs)
      .values({
        jobType: "full_time",
        source: normalizedSource,
        sourceUrl: normalizedUrl.toString(),
        title: parsed.title,
        companyId,
        locationText: parsed.locationText,
        locationType: parsed.locationType,
        employmentType: parsed.employmentType,
        salaryMin: parsed.salaryMin,
        salaryMax: parsed.salaryMax,
        currency: "USD",
        isRejected: scoring.rejected,
        currentStage: scoring.recommendation === "skip" ? "closed" : "review",
        dedupeKey,
      })
      .returning({ id: jobs.id })
      .get())?.id;

  if (!jobId) {
    return { ok: false as const, message: "The job could not be saved." };
  }

  if (existingJob) {
    await db
      .update(jobs)
      .set({
        source: shouldPromoteSource ? normalizedSource : existingJob.source,
        sourceUrl: shouldPromoteSource ? normalizedUrl.toString() : existingJob.sourceUrl,
        title: parsed.title,
        companyId,
        locationText: parsed.locationText,
        locationType: parsed.locationType,
        employmentType: parsed.employmentType,
        salaryMin: parsed.salaryMin,
        salaryMax: parsed.salaryMax,
        isRejected: scoring.rejected,
        currentStage: scoring.recommendation === "skip" ? "closed" : existingJob.currentStage,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobs.id, jobId))
      .run();
  }

  const existingSnapshot = await db
    .select()
    .from(jobSnapshots)
    .where(and(eq(jobSnapshots.jobId, jobId), eq(jobSnapshots.snapshotHash, snapshotHash)))
    .get();

  const snapshotId =
    existingSnapshot?.id ??
    (await db
      .insert(jobSnapshots)
      .values({
        jobId,
        snapshotHash,
        rawText,
        parsedJson: JSON.stringify({
          url: normalizedUrl.toString(),
          company: companyName,
          source: normalizedSource,
          fetchedWarning: fetched.warning,
          dedupeMerged,
        }),
      })
      .returning({ id: jobSnapshots.id })
      .get())?.id;

  const latestScore = await db
    .select({ id: scores.id })
    .from(scores)
    .where(eq(scores.jobId, jobId))
    .orderBy(desc(scores.analyzedAt))
    .get();

  if (latestScore?.id) {
    await db.delete(scoreFactors).where(eq(scoreFactors.scoreId, latestScore.id)).run();
  }

  const scoreId = (await db
    .insert(scores)
    .values({
      jobId,
      snapshotId,
      tier: "tier_0",
      overallScore: scoring.overallScore,
      recommendation: scoring.recommendation,
      recommendedResumeType: null,
      deepReviewRecommended: scoring.recommendation === "deep_review_recommended",
      deepReviewReason:
        scoring.recommendation === "deep_review_recommended"
          ? "Tier 0 found enough upside and ambiguity to justify a deeper review later."
          : null,
      summary: scoring.summary,
      reasonsForJson: JSON.stringify(scoring.reasonsFor),
      reasonsAgainstJson: JSON.stringify(scoring.reasonsAgainst),
    })
    .returning({ id: scores.id })
    .get())?.id;

  if (scoreId) {
    await db
      .insert(scoreFactors)
      .values([
        ...scoring.reasonsFor.map((reason, index) => ({
          scoreId,
          factorKey: `positive_${index + 1}`,
          factorLabel: "Positive signal",
          weight: 1,
          value: 1,
          explanation: reason,
        })),
        ...scoring.reasonsAgainst.map((reason, index) => ({
          scoreId,
          factorKey: `risk_${index + 1}`,
          factorLabel: "Risk signal",
          weight: -1,
          value: -1,
          explanation: reason,
        })),
      ])
      .run();
  }

  return {
    ok: true as const,
    jobId,
    createdNew: !existingJob,
    dedupeMerged,
    warning: fetched.warning,
    message: fetched.warning
      ? fetched.warning
      : dedupeMerged
        ? "Job merged into an existing matching role, snapshotted, and rescored with Tier 0 heuristics."
        : existingJob
          ? "Job refreshed, snapshotted, and rescored with Tier 0 heuristics."
          : "Job imported, snapshotted, and scored with Tier 0 heuristics.",
  };
}
