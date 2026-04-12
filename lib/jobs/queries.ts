import { desc, eq, gte, inArray, sql } from "drizzle-orm";

import { buildDraftPacket } from "@/lib/applications/draft-packet";
import { getApplicationReadiness } from "@/lib/applications/readiness";
import { db } from "@/lib/db/client";
import { companies } from "@/lib/db/schema/companies";
import { aiBudgetSettings, aiUsageEvents } from "@/lib/db/schema/integrations";
import { jobSnapshots, jobs } from "@/lib/db/schema/jobs";
import { candidateProfiles, generatedDocuments } from "@/lib/db/schema/profiles";
import { scores } from "@/lib/db/schema/scoring";
import { applicationEvents, applications, notes, reminders } from "@/lib/db/schema/workflow";
import {
  getJobSourcePriority,
  isBrowserBackedJobSource,
} from "@/lib/jobs/source-preference";

type CompanyRecord = typeof companies.$inferSelect;
type JobRecord = typeof jobs.$inferSelect;
type ApplicationRecord = typeof applications.$inferSelect;
type CandidateProfileRecord = typeof candidateProfiles.$inferSelect;
type GeneratedDocumentRecord = typeof generatedDocuments.$inferSelect;
type ScoreRecord = typeof scores.$inferSelect;
type JobSnapshotRecord = typeof jobSnapshots.$inferSelect;
type NoteRecord = typeof notes.$inferSelect;
type ReminderRecord = typeof reminders.$inferSelect;
type ApplicationEventRecord = typeof applicationEvents.$inferSelect;
type AiBudgetSettingsRecord = typeof aiBudgetSettings.$inferSelect;

export type AiUsageSummary = {
  spent: number;
  requests: number;
};

export type JobListItem = JobRecord & {
  company: CompanyRecord | null;
  score: ScoreRecord | null;
  application: ApplicationRecord | null;
  noteCount: number;
  openReminderCount: number;
  nextReminderAt: string | null;
  duplicateCount: number;
  alternateSources: string[];
  duplicateJobIds: number[];
};

export type JobQueueSnapshot = {
  allJobs: JobListItem[];
  activeJobs: JobListItem[];
  duplicateSuppressedCount: number;
  needsTier1: JobListItem[];
  shortlist: JobListItem[];
  deepReview: JobListItem[];
  followUp: JobListItem[];
  activeReviewQueue: JobListItem[];
  recentBrowserMatches: JobListItem[];
};

export type JobDetail = {
  job: JobRecord;
  company: CompanyRecord | null;
  score: ScoreRecord | null;
  scores: ScoreRecord[];
  snapshot: JobSnapshotRecord | null;
  notes: NoteRecord[];
  reminders: ReminderRecord[];
  documents: GeneratedDocumentRecord[];
  draftPacket: ReturnType<typeof buildDraftPacket>;
  application: ApplicationRecord | null;
  applicationReadiness: ReturnType<typeof getApplicationReadiness>;
  applicationHistory: ApplicationEventRecord[];
  canonicalPosting: (JobRecord & { score: ScoreRecord | null }) | null;
  alternatePostings: Array<
    JobRecord & {
      score: ScoreRecord | null;
      isCanonical: boolean;
      isCurrent: boolean;
    }
  >;
};

export type ApplicationListItem = {
  application: ApplicationRecord;
  job: JobRecord | null;
  company: CompanyRecord | null;
  resumeStrategy: GeneratedDocumentRecord | null;
  coverLetter: GeneratedDocumentRecord | null;
  draftPacket: ReturnType<typeof buildDraftPacket>;
  applicationReadiness: ReturnType<typeof getApplicationReadiness>;
};

export async function listCandidateProfiles() {
  return (await db
    .select()
    .from(candidateProfiles)
    .orderBy(desc(candidateProfiles.isCanonical), candidateProfiles.name)
    .all()) as CandidateProfileRecord[];
}

export async function listGeneratedDocuments() {
  return (await db
    .select()
    .from(generatedDocuments)
    .orderBy(desc(generatedDocuments.createdAt))
    .all()) as GeneratedDocumentRecord[];
}

export async function getAiBudgetSettings() {
  return (await db
    .select()
    .from(aiBudgetSettings)
    .where(eq(aiBudgetSettings.id, 1))
    .get()) as AiBudgetSettingsRecord | undefined;
}

export async function getAiUsageSummary() {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();

  const totals = (await db
    .select({
      spent: sql<number>`coalesce(sum(${aiUsageEvents.actualCost}), 0)`,
      requests: sql<number>`count(${aiUsageEvents.id})`,
    })
    .from(aiUsageEvents)
    .where(gte(aiUsageEvents.createdAt, monthStart))
    .get()) as { spent: number | null; requests: number | null } | undefined;

  return {
    spent: totals?.spent ?? 0,
    requests: totals?.requests ?? 0,
  } satisfies AiUsageSummary;
}

export async function listJobs(): Promise<JobListItem[]> {
  const jobRows = (await db
    .select({
      job: jobs,
      company: companies,
      application: applications,
    })
    .from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .orderBy(desc(jobs.discoveredAt))
    .all()) as Array<{
    job: JobRecord;
    company: CompanyRecord | null;
    application: ApplicationRecord | null;
  }>;

  const jobIds = jobRows.map((row) => row.job.id);
  const scoreRows = jobIds.length
    ? ((await db
        .select()
        .from(scores)
        .where(inArray(scores.jobId, jobIds))
        .orderBy(desc(scores.analyzedAt))
        .all()) as ScoreRecord[])
    : [];
  const noteRows = jobIds.length
    ? ((await db.select().from(notes).where(inArray(notes.jobId, jobIds)).all()) as NoteRecord[])
    : [];
  const reminderRows = jobIds.length
    ? ((await db
        .select()
        .from(reminders)
        .where(inArray(reminders.jobId, jobIds))
        .all()) as ReminderRecord[])
    : [];

  const latestScoresByJobId = new Map<number, (typeof scoreRows)[number]>();
  for (const score of scoreRows) {
    if (!latestScoresByJobId.has(score.jobId)) {
      latestScoresByJobId.set(score.jobId, score);
    }
  }

  const noteCountsByJobId = new Map<number, number>();
  for (const note of noteRows) {
    noteCountsByJobId.set(note.jobId ?? 0, (noteCountsByJobId.get(note.jobId ?? 0) ?? 0) + 1);
  }

  const openRemindersByJobId = new Map<number, (typeof reminderRows)>();
  for (const reminder of reminderRows) {
    if (!reminder.jobId || reminder.status !== "open") {
      continue;
    }

    const existing = openRemindersByJobId.get(reminder.jobId) ?? [];
    existing.push(reminder);
    openRemindersByJobId.set(reminder.jobId, existing);
  }

  const hydratedJobs = jobRows.map(({ job, company, application }) => {
    const openReminders = openRemindersByJobId.get(job.id) ?? [];

    return {
      ...job,
      company,
      score: latestScoresByJobId.get(job.id) ?? null,
      application,
      noteCount: noteCountsByJobId.get(job.id) ?? 0,
      openReminderCount: openReminders.length,
      nextReminderAt: openReminders.map((reminder) => reminder.dueAt).sort()[0] ?? null,
    };
  });

  const groupedJobs = new Map<string, typeof hydratedJobs>();
  for (const job of hydratedJobs) {
    const existing = groupedJobs.get(job.dedupeKey) ?? [];
    existing.push(job);
    groupedJobs.set(job.dedupeKey, existing);
  }

  return [...groupedJobs.values()].map((group) => {
    const sortedGroup = [...group].sort(compareJobsByCanonicalPreference);
    const primary = sortedGroup[0]!;
    const duplicates = sortedGroup.slice(1);
    const alternateSources = Array.from(
      new Set(duplicates.map((job) => job.source).filter((source) => source !== primary.source)),
    );

    return {
      ...primary,
      duplicateCount: duplicates.length,
      alternateSources,
      duplicateJobIds: duplicates.map((job) => job.id),
    };
  });
}

function compareJobsByCanonicalPreference<
  T extends {
    source: string;
    discoveredAt: string;
    score?: { overallScore?: number | null } | null;
  },
>(left: T, right: T) {
  const priorityDelta =
    getJobSourcePriority(right.source) - getJobSourcePriority(left.source);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const scoreDelta = (right.score?.overallScore ?? -1) - (left.score?.overallScore ?? -1);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return right.discoveredAt.localeCompare(left.discoveredAt);
}

function compareJobsByPriority(a: JobListItem, b: JobListItem) {
  const tierWeight = (job: JobListItem) => (job.score?.tier === "tier_1" ? 1 : 0);
  const scoreWeight = (job: JobListItem) => job.score?.overallScore ?? -1;
  const discoveredAt = (job: JobListItem) => job.discoveredAt ?? "";

  return (
    tierWeight(b) - tierWeight(a) ||
    scoreWeight(b) - scoreWeight(a) ||
    discoveredAt(b).localeCompare(discoveredAt(a))
  );
}

function compareJobsByReminder(a: JobListItem, b: JobListItem) {
  const dueA = a.nextReminderAt ?? "";
  const dueB = b.nextReminderAt ?? "";

  if (dueA && dueB) {
    return dueA.localeCompare(dueB);
  }

  if (dueA) {
    return -1;
  }

  if (dueB) {
    return 1;
  }

  return compareJobsByPriority(a, b);
}

export async function getJobQueueSnapshot(): Promise<JobQueueSnapshot> {
  const allJobs = await listJobs();
  const activeJobs = allJobs.filter((job) => job.currentStage !== "closed");
  const browserMatchCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const needsTier1 = activeJobs
    .filter(
      (job) =>
        job.score?.recommendation !== "skip" &&
        job.score?.tier !== "tier_1" &&
        ["new", "review", "tailoring", "ready"].includes(job.currentStage),
    )
    .sort(compareJobsByPriority);

  const shortlist = activeJobs
    .filter(
      (job) =>
        job.score?.recommendation === "tailor" ||
        job.currentStage === "tailoring" ||
        job.currentStage === "ready" ||
        job.application?.status === "ready",
    )
    .sort(compareJobsByPriority);

  const deepReview = activeJobs
    .filter(
      (job) =>
        job.score?.deepReviewRecommended ||
        job.score?.recommendation === "deep_review_recommended",
    )
    .sort(compareJobsByPriority);

  const followUp = activeJobs
    .filter(
      (job) => job.openReminderCount > 0 || job.application?.status === "follow-up",
    )
    .sort(compareJobsByReminder);

  const activeReviewQueue = activeJobs
    .filter(
      (job) =>
        job.score?.recommendation !== "skip" &&
        !shortlist.some((candidate) => candidate.id === job.id) &&
        !deepReview.some((candidate) => candidate.id === job.id) &&
        !followUp.some((candidate) => candidate.id === job.id),
    )
    .sort(compareJobsByPriority);

  const recentBrowserMatches = allJobs
    .filter(
      (job) =>
        isBrowserBackedJobSource(job.source) &&
        job.discoveredAt >= browserMatchCutoff,
    )
    .sort(compareJobsByPriority);

  return {
    allJobs,
    activeJobs,
    duplicateSuppressedCount:
      allJobs.reduce((sum, job) => sum + (job.duplicateCount ?? 0), 0),
    needsTier1,
    shortlist,
    deepReview,
    followUp,
    activeReviewQueue,
    recentBrowserMatches,
  };
}

export async function getJobDetail(jobId: number): Promise<JobDetail | null> {
  const detailRow = (await db
    .select({
      job: jobs,
      company: companies,
      application: applications,
    })
    .from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .where(eq(jobs.id, jobId))
    .get()) as
    | {
        job: JobRecord;
        company: CompanyRecord | null;
        application: ApplicationRecord | null;
      }
    | undefined;
  if (!detailRow) {
    return null;
  }

  const { job, company, application } = detailRow;
  const scoreHistory = (await db
    .select()
    .from(scores)
    .where(eq(scores.jobId, job.id))
    .orderBy(desc(scores.analyzedAt))
    .all()) as ScoreRecord[];
  const score = scoreHistory[0] ?? null;
  const snapshot = (await db
    .select()
    .from(jobSnapshots)
    .where(eq(jobSnapshots.jobId, job.id))
    .orderBy(desc(jobSnapshots.capturedAt))
    .get()) as JobSnapshotRecord | undefined;
  const jobNotes = (await db
    .select()
    .from(notes)
    .where(eq(notes.jobId, job.id))
    .orderBy(desc(notes.createdAt))
    .all()) as NoteRecord[];
  const jobReminders = (await db
    .select()
    .from(reminders)
    .where(eq(reminders.jobId, job.id))
    .orderBy(reminders.dueAt)
    .all()) as ReminderRecord[];
  const documents = (await db
    .select()
    .from(generatedDocuments)
    .where(eq(generatedDocuments.jobId, job.id))
    .orderBy(desc(generatedDocuments.createdAt))
    .all()) as GeneratedDocumentRecord[];
  const applicationHistory = application
    ? ((await db
        .select()
        .from(applicationEvents)
        .where(eq(applicationEvents.applicationId, application.id))
        .orderBy(desc(applicationEvents.createdAt))
        .all()) as ApplicationEventRecord[])
    : [];
  const siblingJobs = (await db
    .select({
      job: jobs,
      company: companies,
    })
    .from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(jobs.dedupeKey, job.dedupeKey))
    .all())
    .map((row: { job: JobRecord; company: CompanyRecord | null }) => row.job);
  const siblingScores = siblingJobs.length
    ? ((await db
        .select()
        .from(scores)
        .where(
          inArray(
            scores.jobId,
            siblingJobs.map((siblingJob: JobRecord) => siblingJob.id),
          ),
        )
        .orderBy(desc(scores.analyzedAt))
        .all()) as ScoreRecord[])
    : [];
  const latestSiblingScores = new Map<number, (typeof siblingScores)[number]>();
  for (const siblingScore of siblingScores) {
    if (!latestSiblingScores.has(siblingScore.jobId)) {
      latestSiblingScores.set(siblingScore.jobId, siblingScore);
    }
  }
  const hydratedSiblingJobs = siblingJobs
    .map((siblingJob: JobRecord) => ({
      ...siblingJob,
      score: latestSiblingScores.get(siblingJob.id) ?? null,
    }))
    .sort(compareJobsByCanonicalPreference);
  const canonicalPosting = hydratedSiblingJobs[0] ?? null;
  const alternatePostings = hydratedSiblingJobs.map((posting: (JobRecord & {
    score: ScoreRecord | null;
  })) => ({
    ...posting,
    isCanonical: posting.id === canonicalPosting?.id,
    isCurrent: posting.id === job.id,
  }));
  const draftPacket = buildDraftPacket(documents, application);
  const applicationReadiness = getApplicationReadiness(application, draftPacket);

  return {
    job,
    company,
    score,
    scores: scoreHistory,
    snapshot: snapshot ?? null,
    notes: jobNotes,
    reminders: jobReminders,
    documents,
    draftPacket,
    application,
    applicationReadiness,
    applicationHistory,
    canonicalPosting,
    alternatePostings,
  };
}

export async function listApplications(): Promise<ApplicationListItem[]> {
  const rows = (await db
    .select({
      application: applications,
      job: jobs,
      company: companies,
    })
    .from(applications)
    .leftJoin(jobs, eq(jobs.id, applications.jobId))
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .orderBy(desc(applications.id))
    .all()) as Array<{
    application: ApplicationRecord;
    job: JobRecord | null;
    company: CompanyRecord | null;
  }>;
  const jobIds = rows.map((row) => row.application.jobId);
  const documentRows = jobIds.length
    ? ((await db
        .select()
        .from(generatedDocuments)
        .where(inArray(generatedDocuments.jobId, jobIds))
        .orderBy(desc(generatedDocuments.createdAt), desc(generatedDocuments.version))
        .all()) as GeneratedDocumentRecord[])
    : [];
  const documentsByJobId = new Map<number, typeof documentRows>();
  const documentsById = new Map<number, (typeof documentRows)[number]>();
  for (const document of documentRows) {
    documentsById.set(document.id, document);
    const existing = documentsByJobId.get(document.jobId ?? 0) ?? [];
    existing.push(document);
    documentsByJobId.set(document.jobId ?? 0, existing);
  }

  return rows.map(({ application, job, company }) => {
    const resumeStrategy = application.resumeDocId
      ? documentsById.get(application.resumeDocId) ?? null
      : null;
    const coverLetter = application.coverLetterDocId
      ? documentsById.get(application.coverLetterDocId) ?? null
      : null;
    const draftPacket = buildDraftPacket(
      documentsByJobId.get(application.jobId) ?? [],
      application,
    );
    const applicationReadiness = getApplicationReadiness(application, draftPacket);

    return {
      application,
      job,
      company,
      resumeStrategy,
      coverLetter,
      draftPacket,
      applicationReadiness,
    };
  });
}
