"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema/jobs";
import { generatedDocuments } from "@/lib/db/schema/profiles";
import { applicationEvents, applications } from "@/lib/db/schema/workflow";

export async function createApplicationFromJobAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));

  if (!Number.isFinite(jobId)) {
    redirect("/applications?status=error&message=Unable to create an application record.");
  }

  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) {
    redirect("/applications?status=error&message=Job not found.");
  }

  const latestResumeStrategy = db
    .select()
    .from(generatedDocuments)
    .where(eq(generatedDocuments.jobId, jobId))
    .orderBy(desc(generatedDocuments.createdAt))
    .all()
    .find((document) => document.documentType === "resume_strategy");

  const latestCoverLetter = db
    .select()
    .from(generatedDocuments)
    .where(eq(generatedDocuments.jobId, jobId))
    .orderBy(desc(generatedDocuments.createdAt))
    .all()
    .find((document) => document.documentType === "cover_letter");

  const existing = db
    .select()
    .from(applications)
    .where(eq(applications.jobId, jobId))
    .get();

  const platform = job.source;
  let applicationId: number | undefined;

  if (existing) {
    db.update(applications)
      .set({
        platform,
        status: existing.status === "new" ? "ready" : existing.status,
        submissionUrl: existing.submissionUrl,
        submissionReference: existing.submissionReference,
        resumeDocId: latestResumeStrategy?.id ?? existing.resumeDocId,
        coverLetterDocId: latestCoverLetter?.id ?? existing.coverLetterDocId,
        notes: existing.notes,
      })
      .where(eq(applications.id, existing.id))
      .run();
    applicationId = existing.id;
  } else {
    applicationId = db
      .insert(applications)
      .values({
        jobId,
        platform,
        status: "ready",
        submissionUrl: null,
        submissionReference: null,
        resumeDocId: latestResumeStrategy?.id ?? null,
        coverLetterDocId: latestCoverLetter?.id ?? null,
      })
      .returning({ id: applications.id })
      .get()?.id;
  }

  if (!applicationId) {
    redirect(`/jobs/${jobId}?status=error&message=Unable to create the application record.`);
  }

  db.insert(applicationEvents)
    .values({
      applicationId,
      eventType: existing ? "application_refreshed" : "application_created",
      payloadJson: JSON.stringify({
        resumeDocId: latestResumeStrategy?.id ?? null,
        coverLetterDocId: latestCoverLetter?.id ?? null,
      }),
    })
    .run();

  db.update(jobs)
    .set({
      currentStage: "ready",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(jobs.id, jobId))
    .run();

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/tailor/${jobId}`);
  revalidatePath("/applications");

  redirect(
    `/jobs/${jobId}?status=success&message=${encodeURIComponent(
      existing
        ? "Application record refreshed and linked to the latest drafts."
        : "Application record created from this job and its latest drafts.",
    )}`,
  );
}

export async function updateApplicationAction(formData: FormData) {
  const applicationId = Number(formData.get("applicationId"));
  const jobId = Number(formData.get("jobId"));
  const platform = String(formData.get("platform") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const submittedAtRaw = String(formData.get("submittedAt") ?? "").trim();
  const submissionUrl = String(formData.get("submissionUrl") ?? "").trim();
  const submissionReference = String(formData.get("submissionReference") ?? "").trim();
  const notes = String(formData.get("applicationNotes") ?? "").trim();

  if (!Number.isFinite(applicationId) || !Number.isFinite(jobId) || !status) {
    redirect(`/jobs/${jobId}?status=error&message=Unable to update the application record.`);
  }

  const existing = db
    .select()
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get();

  if (!existing) {
    redirect(`/jobs/${jobId}?status=error&message=Application record not found.`);
  }

  const submittedAt = submittedAtRaw
    ? new Date(submittedAtRaw).toISOString()
    : status === "applied" && !existing.submittedAt
      ? new Date().toISOString()
      : existing.submittedAt;

  db.update(applications)
    .set({
      platform: platform || existing.platform,
      status,
      submittedAt,
      submissionUrl: submissionUrl || null,
      submissionReference: submissionReference || null,
      notes: notes || null,
    })
    .where(eq(applications.id, applicationId))
    .run();

  db.insert(applicationEvents)
    .values({
      applicationId,
      eventType: "application_updated",
      payloadJson: JSON.stringify({
        previousStatus: existing.status,
        nextStatus: status,
        submittedAt,
        submissionUrl: submissionUrl || null,
        submissionReference: submissionReference || null,
      }),
    })
    .run();

  const nextStageMap: Record<string, string> = {
    ready: "ready",
    applied: "applied",
    "follow-up": "follow-up",
    interview: "interview",
    closed: "closed",
  };

  db.update(jobs)
    .set({
      currentStage: nextStageMap[status] ?? "ready",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(jobs.id, jobId))
    .run();

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/tailor/${jobId}`);
  revalidatePath("/applications");

  redirect(`/jobs/${jobId}?status=success&message=${encodeURIComponent("Application updated.")}`);
}
