import { getDraftPacketForJob, inferJobStageFromPacket } from "@/lib/applications/draft-packet";
import { getApplicationReadiness, inferApplicationWorkflowStatus } from "@/lib/applications/readiness";
import {
  createApplicationEvent,
  getApplicationRecordForJob,
  getGeneratedDocumentRecord,
  getJobRecord,
  supersedeApprovedDocuments,
  updateApplicationRecord,
  updateGeneratedDocumentRecord,
  updateJobRecord,
} from "@/lib/applications/store";

export async function approveGeneratedDocument(input: { documentId: number; jobId: number }) {
  const document = await getGeneratedDocumentRecord(input.documentId);

  if (!document || document.jobId !== input.jobId) {
    return {
      ok: false as const,
      message: "Document not found.",
    };
  }

  await updateGeneratedDocumentRecord(input.documentId, {
    approvalState: "approved",
  });

  await supersedeApprovedDocuments({
    jobId: input.jobId,
    documentType: document.documentType,
    exceptDocumentId: input.documentId,
  });

  return {
    ok: true as const,
    documentType: document.documentType,
    version: document.version,
  };
}

export async function linkDocumentToApplication(input: { documentId: number; jobId: number }) {
  const document = await getGeneratedDocumentRecord(input.documentId);

  if (!document || document.jobId !== input.jobId) {
    return {
      ok: false as const,
      message: "Document not found.",
    };
  }

  const application = await getApplicationRecordForJob(input.jobId);

  if (!application) {
    return {
      ok: false as const,
      message: "Create an application record before linking a specific document version.",
    };
  }

  if (document.documentType === "resume_strategy") {
    await updateApplicationRecord(application.id, {
      resumeDocId: document.id,
    });
  } else if (document.documentType === "cover_letter") {
    await updateApplicationRecord(application.id, {
      coverLetterDocId: document.id,
    });
  } else {
    return {
      ok: false as const,
      message:
        "Only resume strategies and cover letters can be linked to the application record right now.",
    };
  }

  const refreshedApplication = await getApplicationRecordForJob(input.jobId);

  if (!refreshedApplication) {
    return {
      ok: false as const,
      message: "Application record not found after update.",
    };
  }

  const packet = await getDraftPacketForJob(input.jobId, refreshedApplication);
  const readiness = getApplicationReadiness(refreshedApplication, packet);
  const nextStatus = inferApplicationWorkflowStatus({
    currentStatus: refreshedApplication.status,
    readiness,
  });

  await updateApplicationRecord(refreshedApplication.id, {
    status: nextStatus,
  });

  await createApplicationEvent({
    applicationId: refreshedApplication.id,
    eventType: "application_document_selected",
    payload: {
      documentId: document.id,
      documentType: document.documentType,
      version: document.version,
    },
  });

  const job = await getJobRecord(input.jobId);
  if (job) {
    await updateJobRecord(input.jobId, {
      currentStage: inferJobStageFromPacket({
        currentStage: job.currentStage,
        applicationStatus: nextStatus,
        packet,
      }),
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    ok: true as const,
    documentType: document.documentType,
    version: document.version,
  };
}
