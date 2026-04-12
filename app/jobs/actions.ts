"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runTier1Analysis } from "@/lib/ai/tier1-analysis";
import {
  addJobNote,
  addJobReminder,
  importManualJob,
  updateJobStage,
  updateReminderStatus,
} from "@/lib/jobs/workflow-store";
import { getHostedPreviewWriteRedirect } from "@/lib/runtime/deployment";

export async function importJobAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect("/jobs", "import jobs");
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await importManualJob({
    url: String(formData.get("url") ?? ""),
    manualTitle: String(formData.get("manualTitle") ?? ""),
    manualCompany: String(formData.get("manualCompany") ?? ""),
    manualLocation: String(formData.get("manualLocation") ?? ""),
    rawDescription: String(formData.get("rawDescription") ?? ""),
  });

  revalidatePath("/jobs");

  if (!result.ok) {
    redirect(`/jobs?status=error&message=${encodeURIComponent(result.message)}`);
  }

  const query = new URLSearchParams({
    status: result.warning ? "warning" : "success",
    message: result.message,
  });

  redirect(`/jobs/${result.jobId}?${query.toString()}`);
}

export async function updateJobStageAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/jobs/${jobId}` : "/jobs",
    "update job stages",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }
  const stage = String(formData.get("stage") ?? "");

  if (!Number.isFinite(jobId) || !stage) {
    redirect("/applications?status=error&message=Unable to update the job stage.");
  }

  const result = await updateJobStage({ jobId, stage });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");

  const status = result.ok ? "success" : "error";
  redirect(`/jobs/${jobId}?status=${status}&message=${encodeURIComponent(result.message)}`);
}

export async function addJobNoteAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/jobs/${jobId}` : "/jobs",
    "add job notes",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }
  const body = String(formData.get("body") ?? "").trim();

  if (!Number.isFinite(jobId) || !body) {
    redirect(`/jobs/${jobId}?status=error&message=${encodeURIComponent("A note could not be saved.")}`);
  }

  const result = await addJobNote({ jobId, body });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");

  const status = result.ok ? "success" : "error";
  redirect(`/jobs/${jobId}?status=${status}&message=${encodeURIComponent(result.message)}`);
}

export async function addJobReminderAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/jobs/${jobId}` : "/jobs",
    "add job reminders",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }
  const title = String(formData.get("title") ?? "").trim();
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();

  if (!Number.isFinite(jobId) || !title || !dueAtRaw) {
    redirect(
      `/jobs/${jobId}?status=error&message=${encodeURIComponent("A reminder could not be saved.")}`,
    );
  }

  const dueAt = new Date(dueAtRaw);
  if (Number.isNaN(dueAt.getTime())) {
    redirect(
      `/jobs/${jobId}?status=error&message=${encodeURIComponent("Reminder date is invalid.")}`,
    );
  }

  const result = await addJobReminder({
    jobId,
    title,
    dueAtRaw,
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");

  const status = result.ok ? "success" : "error";
  redirect(`/jobs/${jobId}?status=${status}&message=${encodeURIComponent(result.message)}`);
}

export async function updateReminderStatusAction(formData: FormData) {
  const reminderId = Number(formData.get("reminderId"));
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/jobs/${jobId}` : "/jobs",
    "update reminders",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }
  const status = String(formData.get("status") ?? "open");

  if (!Number.isFinite(reminderId) || !Number.isFinite(jobId)) {
    redirect("/applications?status=error&message=Unable to update the reminder.");
  }

  const result = await updateReminderStatus({ reminderId, jobId, status });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");

  const resultStatus = result.ok ? "success" : "error";
  redirect(`/jobs/${jobId}?status=${resultStatus}&message=${encodeURIComponent(result.message)}`);
}

export async function runTier1AnalysisAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/jobs/${jobId}` : "/jobs",
    "run Tier 1 analysis",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  if (!Number.isFinite(jobId)) {
    redirect("/jobs?status=error&message=Unable to run Tier 1 analysis.");
  }

  const result = await runTier1Analysis(jobId);

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/settings/ai");

  const status = result.ok ? "success" : "error";
  const redirectPath = `/jobs/${jobId}?status=${status}&message=${encodeURIComponent(
    result.message,
  )}`;

  redirect(redirectPath as never);
}
