import { desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { companies } from "@/lib/db/schema/companies";
import { aiBudgetSettings, aiUsageEvents } from "@/lib/db/schema/integrations";
import { jobSnapshots, jobs } from "@/lib/db/schema/jobs";
import { candidateProfiles, generatedDocuments } from "@/lib/db/schema/profiles";
import { scores } from "@/lib/db/schema/scoring";
import { applicationEvents, applications, notes, reminders } from "@/lib/db/schema/workflow";

export function listCandidateProfiles() {
  return db
    .select()
    .from(candidateProfiles)
    .orderBy(desc(candidateProfiles.isCanonical), candidateProfiles.name)
    .all();
}

export function listGeneratedDocuments() {
  return db
    .select()
    .from(generatedDocuments)
    .orderBy(desc(generatedDocuments.createdAt))
    .all();
}

export function getAiBudgetSettings() {
  return db.select().from(aiBudgetSettings).where(eq(aiBudgetSettings.id, 1)).get();
}

export function getAiUsageSummary() {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();

  const totals = db
    .select({
      spent: sql<number>`coalesce(sum(${aiUsageEvents.actualCost}), 0)`,
      requests: sql<number>`count(${aiUsageEvents.id})`,
    })
    .from(aiUsageEvents)
    .where(gte(aiUsageEvents.createdAt, monthStart))
    .get();

  return {
    spent: totals?.spent ?? 0,
    requests: totals?.requests ?? 0,
  };
}

export function listJobs() {
  const jobRows = db.select().from(jobs).orderBy(desc(jobs.discoveredAt)).all();

  return jobRows.map((job) => {
    const company = job.companyId
      ? db.select().from(companies).where(eq(companies.id, job.companyId)).get()
      : null;
    const score = db
      .select()
      .from(scores)
      .where(eq(scores.jobId, job.id))
      .orderBy(desc(scores.analyzedAt))
      .get();
    const noteCount = db
      .select()
      .from(notes)
      .where(eq(notes.jobId, job.id))
      .all().length;
    const openReminders = db
      .select()
      .from(reminders)
      .where(eq(reminders.jobId, job.id))
      .all()
      .filter((reminder) => reminder.status === "open");
    const application = db
      .select()
      .from(applications)
      .where(eq(applications.jobId, job.id))
      .get();

    return {
      ...job,
      company,
      score,
      application,
      noteCount,
      openReminderCount: openReminders.length,
      nextReminderAt: openReminders
        .map((reminder) => reminder.dueAt)
        .sort()[0] ?? null,
    };
  });
}

export function getJobDetail(jobId: number) {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) {
    return null;
  }

  const company = job.companyId
    ? db.select().from(companies).where(eq(companies.id, job.companyId)).get()
    : null;
  const score = db
    .select()
    .from(scores)
    .where(eq(scores.jobId, job.id))
    .orderBy(desc(scores.analyzedAt))
    .get();
  const snapshot = db
    .select()
    .from(jobSnapshots)
    .where(eq(jobSnapshots.jobId, job.id))
    .orderBy(desc(jobSnapshots.capturedAt))
    .get();
  const jobNotes = db
    .select()
    .from(notes)
    .where(eq(notes.jobId, job.id))
    .orderBy(desc(notes.createdAt))
    .all();
  const jobReminders = db
    .select()
    .from(reminders)
    .where(eq(reminders.jobId, job.id))
    .orderBy(reminders.dueAt)
    .all();
  const documents = db
    .select()
    .from(generatedDocuments)
    .where(eq(generatedDocuments.jobId, job.id))
    .orderBy(desc(generatedDocuments.createdAt))
    .all();
  const application = db
    .select()
    .from(applications)
    .where(eq(applications.jobId, job.id))
    .get();
  const applicationHistory = application
    ? db
        .select()
        .from(applicationEvents)
        .where(eq(applicationEvents.applicationId, application.id))
        .orderBy(desc(applicationEvents.createdAt))
        .all()
    : [];

  return {
    job,
    company,
    score,
    snapshot,
    notes: jobNotes,
    reminders: jobReminders,
    documents,
    application,
    applicationHistory,
  };
}

export function listApplications() {
  const rows = db.select().from(applications).orderBy(desc(applications.id)).all();

  return rows.map((application) => {
    const job = db.select().from(jobs).where(eq(jobs.id, application.jobId)).get();
    const company = job?.companyId
      ? db.select().from(companies).where(eq(companies.id, job.companyId)).get()
      : null;
    const resumeStrategy = application.resumeDocId
      ? db
          .select()
          .from(generatedDocuments)
          .where(eq(generatedDocuments.id, application.resumeDocId))
          .get()
      : null;
    const coverLetter = application.coverLetterDocId
      ? db
          .select()
          .from(generatedDocuments)
          .where(eq(generatedDocuments.id, application.coverLetterDocId))
          .get()
      : null;

    return {
      application,
      job,
      company,
      resumeStrategy,
      coverLetter,
    };
  });
}
