import { eq } from "drizzle-orm";

import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema/jobs";
import { notes, reminders } from "@/lib/db/schema/workflow";
import { importJob } from "@/lib/jobs/import-job";

type ImportManualJobInput = {
  url: string;
  manualTitle?: string;
  manualCompany?: string;
  manualLocation?: string;
  rawDescription?: string;
};

export async function importManualJob(input: ImportManualJobInput) {
  await ensureDefaultRecords();
  return importJob(input);
}

export async function updateJobStage(input: { jobId: number; stage: string }) {
  if (!Number.isFinite(input.jobId) || !input.stage) {
    return {
      ok: false as const,
      message: "Unable to update the job stage.",
    };
  }

  await db
    .update(jobs)
    .set({
      currentStage: input.stage,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(jobs.id, input.jobId))
    .run();

  return {
    ok: true as const,
    message: "Stage updated.",
  };
}

export async function addJobNote(input: { jobId: number; body: string }) {
  if (!Number.isFinite(input.jobId) || !input.body.trim()) {
    return {
      ok: false as const,
      message: "A note could not be saved.",
    };
  }

  await db
    .insert(notes)
    .values({
      jobId: input.jobId,
      body: input.body.trim(),
    })
    .run();

  return {
    ok: true as const,
    message: "Note added.",
  };
}

export async function addJobReminder(input: {
  jobId: number;
  title: string;
  dueAtRaw: string;
}) {
  if (!Number.isFinite(input.jobId) || !input.title.trim() || !input.dueAtRaw.trim()) {
    return {
      ok: false as const,
      message: "A reminder could not be saved.",
    };
  }

  const dueAt = new Date(input.dueAtRaw.trim());
  if (Number.isNaN(dueAt.getTime())) {
    return {
      ok: false as const,
      message: "Reminder date is invalid.",
    };
  }

  await db
    .insert(reminders)
    .values({
      jobId: input.jobId,
      title: input.title.trim(),
      dueAt: dueAt.toISOString(),
      status: "open",
    })
    .run();

  return {
    ok: true as const,
    message: "Reminder added.",
  };
}

export async function updateReminderStatus(input: {
  reminderId: number;
  jobId: number;
  status: string;
}) {
  if (!Number.isFinite(input.reminderId) || !Number.isFinite(input.jobId)) {
    return {
      ok: false as const,
      message: "Unable to update the reminder.",
    };
  }

  await db
    .update(reminders)
    .set({
      status: input.status,
    })
    .where(eq(reminders.id, input.reminderId))
    .run();

  return {
    ok: true as const,
    message: "Reminder updated.",
  };
}
