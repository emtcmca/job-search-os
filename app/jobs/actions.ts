"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema/jobs";
import { notes, reminders } from "@/lib/db/schema/workflow";
import { runTier1Analysis } from "@/lib/ai/tier1-analysis";
import { importJob } from "@/lib/jobs/import-job";

export async function importJobAction(formData: FormData) {
  await ensureDefaultRecords();

  const result = await importJob({
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
  const stage = String(formData.get("stage") ?? "");

  if (!Number.isFinite(jobId) || !stage) {
    redirect("/applications?status=error&message=Unable to update the job stage.");
  }

  db.update(jobs)
    .set({
      currentStage: stage,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(jobs.id, jobId))
    .run();

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");

  redirect(`/jobs/${jobId}?status=success&message=${encodeURIComponent("Stage updated.")}`);
}

export async function addJobNoteAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const body = String(formData.get("body") ?? "").trim();

  if (!Number.isFinite(jobId) || !body) {
    redirect(`/jobs/${jobId}?status=error&message=${encodeURIComponent("A note could not be saved.")}`);
  }

  db.insert(notes)
    .values({
      jobId,
      body,
    })
    .run();

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");

  redirect(`/jobs/${jobId}?status=success&message=${encodeURIComponent("Note added.")}`);
}

export async function addJobReminderAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
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

  db.insert(reminders)
    .values({
      jobId,
      title,
      dueAt: dueAt.toISOString(),
      status: "open",
    })
    .run();

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");

  redirect(`/jobs/${jobId}?status=success&message=${encodeURIComponent("Reminder added.")}`);
}

export async function updateReminderStatusAction(formData: FormData) {
  const reminderId = Number(formData.get("reminderId"));
  const jobId = Number(formData.get("jobId"));
  const status = String(formData.get("status") ?? "open");

  if (!Number.isFinite(reminderId) || !Number.isFinite(jobId)) {
    redirect("/applications?status=error&message=Unable to update the reminder.");
  }

  db.update(reminders)
    .set({
      status,
    })
    .where(eq(reminders.id, reminderId))
    .run();

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/applications");

  redirect(`/jobs/${jobId}?status=success&message=${encodeURIComponent("Reminder updated.")}`);
}

export async function runTier1AnalysisAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));

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
