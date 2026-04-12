import { getDraftPacketForJob, inferJobStageFromPacket } from "@/lib/applications/draft-packet";
import {
  getApplicationReadiness,
  inferApplicationWorkflowStatus,
} from "@/lib/applications/readiness";
import {
  createApplicationEvent,
  createApplicationRecord,
  createReminderRecord,
  getApplicationRecord,
  getApplicationRecordForJob,
  getJobRecord,
  updateApplicationRecord,
  updateJobRecord,
} from "@/lib/applications/store";

function createApplicationReminder(input: {
  applicationId: number;
  jobId: number;
  title: string;
  dueAtRaw: string;
}) {
  const dueAt = new Date(input.dueAtRaw);
  if (Number.isNaN(dueAt.getTime())) {
    return Promise.resolve(false);
  }

  return createReminderRecord({
    applicationId: input.applicationId,
    jobId: input.jobId,
    title: input.title,
    dueAt: dueAt.toISOString(),
  }).then(() => true);
}

export async function createOrRefreshApplicationFromJob(jobId: number) {
  const job = await getJobRecord(jobId);
  if (!job) {
    return {
      ok: false as const,
      message: "Job not found.",
    };
  }

  const existing = await getApplicationRecordForJob(jobId);
  const packet = await getDraftPacketForJob(jobId, existing);
  const readiness = getApplicationReadiness(existing, packet);
  const nextStatus = inferApplicationWorkflowStatus({
    currentStatus: existing?.status,
    readiness,
  });

  const applicationId = existing
    ? existing.id
    : await createApplicationRecord({
        jobId,
        platform: job.source,
        status: nextStatus,
        submissionUrl: null,
        submissionReference: null,
        resumeDocId: packet.preferredResumeStrategy?.id ?? null,
        coverLetterDocId: packet.preferredCoverLetter?.id ?? null,
        followUpRequired: false,
        followUpInstructions: null,
      });

  if (existing) {
    await updateApplicationRecord(existing.id, {
      platform: job.source,
      status: nextStatus,
      submissionUrl: existing.submissionUrl,
      submissionReference: existing.submissionReference,
      resumeDocId: packet.preferredResumeStrategy?.id ?? existing.resumeDocId,
      coverLetterDocId: packet.preferredCoverLetter?.id ?? existing.coverLetterDocId,
      followUpRequired: existing.followUpRequired,
      followUpInstructions: existing.followUpInstructions,
      notes: existing.notes,
    });
  }

  if (!applicationId) {
    return {
      ok: false as const,
      message: "Unable to create the application record.",
    };
  }

  await createApplicationEvent({
    applicationId,
    eventType: existing ? "application_refreshed" : "application_created",
    payload: {
      resumeDocId: packet.preferredResumeStrategy?.id ?? null,
      coverLetterDocId: packet.preferredCoverLetter?.id ?? null,
      missingDocuments: packet.missingDocuments,
      missingReadyItems: readiness.missingReadyItems,
    },
  });

  await updateJobRecord(jobId, {
    currentStage: inferJobStageFromPacket({
      currentStage: job.currentStage,
      applicationStatus: nextStatus,
      packet,
    }),
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true as const,
    existed: Boolean(existing),
    readyToSubmit: readiness.readyToSubmit,
    missingReadyItems: readiness.missingReadyItems,
  };
}

export async function updateApplicationWorkflow(input: {
  applicationId: number;
  jobId: number;
  platform: string;
  status: string;
  submittedAtRaw: string;
  submissionUrl: string;
  submissionReference: string;
  followUpRequired: boolean;
  followUpInstructions: string;
  nextFollowUpAt: string;
  notes: string;
}) {
  const existing = await getApplicationRecord(input.applicationId);

  if (!existing) {
    return {
      ok: false as const,
      message: "Application record not found.",
    };
  }

  const explicitSubmittedAt = input.submittedAtRaw ? new Date(input.submittedAtRaw) : null;
  if (explicitSubmittedAt && Number.isNaN(explicitSubmittedAt.getTime())) {
    return {
      ok: false as const,
      message: "Submitted date is invalid.",
    };
  }

  const submittedAt = explicitSubmittedAt
    ? explicitSubmittedAt.toISOString()
    : input.status === "applied" && !existing.submittedAt
      ? new Date().toISOString()
      : existing.submittedAt;
  const packet = await getDraftPacketForJob(input.jobId, existing);
  const nextApplicationShape = {
    ...existing,
    platform: input.platform || existing.platform,
    status: input.status,
    submittedAt,
    submissionUrl: input.submissionUrl || null,
    submissionReference: input.submissionReference || null,
    followUpRequired: input.followUpRequired,
    followUpInstructions: input.followUpInstructions || null,
    notes: input.notes || null,
  };
  const readiness = getApplicationReadiness(nextApplicationShape, packet);
  const nextStatus =
    input.status === "ready"
      ? inferApplicationWorkflowStatus({
          currentStatus: input.status,
          readiness,
        })
      : input.status;

  await updateApplicationRecord(input.applicationId, {
    platform: input.platform || existing.platform,
    status: nextStatus,
    submittedAt,
    submissionUrl: input.submissionUrl || null,
    submissionReference: input.submissionReference || null,
    followUpRequired: input.followUpRequired,
    followUpInstructions: input.followUpInstructions || null,
    notes: input.notes || null,
  });

  await createApplicationEvent({
    applicationId: input.applicationId,
    eventType: "application_updated",
    payload: {
      previousStatus: existing.status,
      nextStatus,
      submittedAt,
      submissionUrl: input.submissionUrl || null,
      submissionReference: input.submissionReference || null,
      followUpRequired: input.followUpRequired,
      missingReadyItems: readiness.missingReadyItems,
    },
  });

  if (input.status === "applied" && existing.status !== "applied") {
    await createApplicationEvent({
      applicationId: input.applicationId,
      eventType: "submission_recorded",
      payload: {
        submittedAt,
        submissionUrl: input.submissionUrl || null,
        submissionReference: input.submissionReference || null,
        followUpRequired: input.followUpRequired,
        followUpInstructions: input.followUpInstructions || null,
      },
    });
  }

  if (input.nextFollowUpAt) {
    const job = await getJobRecord(input.jobId);
    await createApplicationReminder({
      applicationId: input.applicationId,
      jobId: input.jobId,
      title: `Follow up on ${job?.title ?? "application"}`,
      dueAtRaw: input.nextFollowUpAt,
    });
  }

  const nextStageMap: Record<string, string> = {
    new: "tailoring",
    ready: inferJobStageFromPacket({
      currentStage: "ready",
      applicationStatus: nextStatus,
      packet,
    }),
    applied: "applied",
    "follow-up": "follow-up",
    interview: "interview",
    closed: "closed",
  };

  await updateJobRecord(input.jobId, {
    currentStage: nextStageMap[nextStatus] ?? "ready",
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true as const,
    downgradedReady: input.status === "ready" && nextStatus !== "ready",
    missingReadyItems: readiness.missingReadyItems,
  };
}

export async function logApplicationEvent(input: {
  applicationId: number;
  jobId: number;
  eventType: string;
  summary: string;
  details: string;
  occurredAtRaw: string;
  reminderDueAt: string;
  reminderTitle: string;
}) {
  const application = await getApplicationRecord(input.applicationId);

  if (!application) {
    return {
      ok: false as const,
      message: "Application record not found.",
    };
  }

  const occurredAt = input.occurredAtRaw ? new Date(input.occurredAtRaw) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return {
      ok: false as const,
      message: "Event date is invalid.",
    };
  }

  await createApplicationEvent({
    applicationId: input.applicationId,
    eventType: input.eventType,
    payload: {
      summary: input.summary,
      details: input.details || null,
      occurredAt: occurredAt.toISOString(),
      source: "manual",
      reminderDueAt: input.reminderDueAt || null,
    },
  });

  const nextStatusMap: Record<string, string> = {
    follow_up_sent: "follow-up",
    interview_requested: "interview",
    rejection_received: "closed",
  };
  const nextStatus = nextStatusMap[input.eventType];

  if (nextStatus) {
    await updateApplicationRecord(input.applicationId, {
      status: nextStatus,
    });

    await updateJobRecord(input.jobId, {
      currentStage: nextStatus === "interview" ? "interview" : nextStatus,
      updatedAt: new Date().toISOString(),
    });
  }

  if (input.reminderDueAt) {
    await createApplicationReminder({
      applicationId: input.applicationId,
      jobId: input.jobId,
      title: input.reminderTitle || input.summary,
      dueAtRaw: input.reminderDueAt,
    });
  }

  return {
    ok: true as const,
  };
}
