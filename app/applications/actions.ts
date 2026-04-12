"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createOrRefreshApplicationFromJob,
  logApplicationEvent,
  updateApplicationWorkflow,
} from "@/lib/applications/workflow-store";
import { getHostedPreviewWriteRedirect } from "@/lib/runtime/deployment";

export async function createApplicationFromJobAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/jobs/${jobId}` : "/applications",
    "create or refresh application records",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  if (!Number.isFinite(jobId)) {
    redirect("/applications?status=error&message=Unable to create an application record.");
  }

  const result = await createOrRefreshApplicationFromJob(jobId);
  if (!result.ok) {
    redirect(`/jobs/${jobId}?status=error&message=${encodeURIComponent(result.message)}`);
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/tailor/${jobId}`);
  revalidatePath("/applications");

  redirect(
    `/jobs/${jobId}?status=success&message=${encodeURIComponent(
      result.existed
        ? result.readyToSubmit
          ? "Application record refreshed and ready for submission."
          : `Application record refreshed. Still missing: ${result.missingReadyItems.join(", ")}.`
        : result.readyToSubmit
          ? "Application record created and ready for submission."
          : `Application record created, but it is not ready yet: ${result.missingReadyItems.join(", ")}.`,
    )}`,
  );
}

export async function updateApplicationAction(formData: FormData) {
  const applicationId = Number(formData.get("applicationId"));
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/jobs/${jobId}` : "/applications",
    "update application records",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }
  const platform = String(formData.get("platform") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const submittedAtRaw = String(formData.get("submittedAt") ?? "").trim();
  const submissionUrl = String(formData.get("submissionUrl") ?? "").trim();
  const submissionReference = String(formData.get("submissionReference") ?? "").trim();
  const followUpRequired = formData.get("followUpRequired") === "on";
  const followUpInstructions = String(formData.get("followUpInstructions") ?? "").trim();
  const nextFollowUpAt = String(formData.get("nextFollowUpAt") ?? "").trim();
  const notes = String(formData.get("applicationNotes") ?? "").trim();

  if (!Number.isFinite(applicationId) || !Number.isFinite(jobId) || !status) {
    redirect(`/jobs/${jobId}?status=error&message=Unable to update the application record.`);
  }

  const result = await updateApplicationWorkflow({
    applicationId,
    jobId,
    platform,
    status,
    submittedAtRaw,
    submissionUrl,
    submissionReference,
    followUpRequired,
    followUpInstructions,
    nextFollowUpAt,
    notes,
  });

  if (!result.ok) {
    redirect(`/jobs/${jobId}?status=error&message=${encodeURIComponent(result.message)}`);
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/tailor/${jobId}`);
  revalidatePath("/applications");

  redirect(
    `/jobs/${jobId}?status=${
      result.downgradedReady ? "warning" : "success"
    }&message=${encodeURIComponent(
      result.downgradedReady
        ? `Application saved, but it is not ready yet: ${result.missingReadyItems.join(", ")}.`
        : "Application updated.",
    )}`,
  );
}

export async function logApplicationEventAction(formData: FormData) {
  const applicationId = Number(formData.get("applicationId"));
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/jobs/${jobId}` : "/applications",
    "log application events",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }
  const eventType = String(formData.get("eventType") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const occurredAtRaw = String(formData.get("occurredAt") ?? "").trim();
  const reminderDueAt = String(formData.get("reminderDueAt") ?? "").trim();
  const reminderTitle = String(formData.get("reminderTitle") ?? "").trim();

  if (!Number.isFinite(applicationId) || !Number.isFinite(jobId) || !eventType || !summary) {
    redirect(`/jobs/${jobId}?status=error&message=Unable to log the application event.`);
  }

  const result = await logApplicationEvent({
    applicationId,
    jobId,
    eventType,
    summary,
    details,
    occurredAtRaw,
    reminderDueAt,
    reminderTitle,
  });

  if (!result.ok) {
    redirect(`/jobs/${jobId}?status=error&message=${encodeURIComponent(result.message)}`);
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/tailor/${jobId}`);
  revalidatePath("/applications");

  redirect(`/jobs/${jobId}?status=success&message=${encodeURIComponent("Application event logged.")}`);
}
