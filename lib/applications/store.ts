import { and, eq, ne } from "drizzle-orm";

import {
  insertRecordAsync,
  insertRecordReturningAsync,
  selectFirstByColumnAsync,
  updateRecordByColumnAsync,
  updateRecordWhereAsync,
} from "@/lib/db/store-helpers";
import { jobs } from "@/lib/db/schema/jobs";
import { generatedDocuments } from "@/lib/db/schema/profiles";
import { applicationEvents, applications, reminders } from "@/lib/db/schema/workflow";

export type JobRecord = typeof jobs.$inferSelect;
export type ApplicationRecord = typeof applications.$inferSelect;
export type GeneratedDocumentRecord = typeof generatedDocuments.$inferSelect;

export async function getJobRecord(jobId: number) {
  return (await selectFirstByColumnAsync(jobs, jobs.id, jobId)) as JobRecord | undefined;
}

export async function getApplicationRecord(applicationId: number) {
  return (await selectFirstByColumnAsync(applications, applications.id, applicationId)) as
    | ApplicationRecord
    | undefined;
}

export async function getApplicationRecordForJob(jobId: number) {
  return (await selectFirstByColumnAsync(applications, applications.jobId, jobId)) as
    | ApplicationRecord
    | undefined;
}

export async function createApplicationRecord(values: typeof applications.$inferInsert) {
  const inserted = (await insertRecordReturningAsync(applications, values, {
    id: applications.id,
  })) as { id: number } | undefined;
  return inserted?.id;
}

export async function updateApplicationRecord(
  applicationId: number,
  values: Partial<typeof applications.$inferInsert>,
) {
  await updateRecordByColumnAsync(applications, applications.id, applicationId, values);
}

export async function createApplicationEvent(input: {
  applicationId: number;
  eventType: string;
  payload: unknown;
}) {
  await insertRecordAsync(applicationEvents, {
    applicationId: input.applicationId,
    eventType: input.eventType,
    payloadJson: JSON.stringify(input.payload),
  });
}

export async function createReminderRecord(input: {
  applicationId: number;
  jobId: number;
  title: string;
  dueAt: string;
}) {
  await insertRecordAsync(reminders, {
    applicationId: input.applicationId,
    jobId: input.jobId,
    title: input.title,
    dueAt: input.dueAt,
    status: "open",
  });
}

export async function updateJobRecord(
  jobId: number,
  values: Partial<typeof jobs.$inferInsert>,
) {
  await updateRecordByColumnAsync(jobs, jobs.id, jobId, values);
}

export async function getGeneratedDocumentRecord(documentId: number) {
  return (await selectFirstByColumnAsync(
    generatedDocuments,
    generatedDocuments.id,
    documentId,
  )) as GeneratedDocumentRecord | undefined;
}

export async function updateGeneratedDocumentRecord(
  documentId: number,
  values: Partial<typeof generatedDocuments.$inferInsert>,
) {
  await updateRecordByColumnAsync(
    generatedDocuments,
    generatedDocuments.id,
    documentId,
    values,
  );
}

export async function supersedeApprovedDocuments(input: {
  jobId: number;
  documentType: string;
  exceptDocumentId: number;
}) {
  await updateRecordWhereAsync(
    generatedDocuments,
    and(
      eq(generatedDocuments.jobId, input.jobId),
      eq(generatedDocuments.documentType, input.documentType),
      ne(generatedDocuments.id, input.exceptDocumentId),
      eq(generatedDocuments.approvalState, "approved"),
    ),
    {
      approvalState: "superseded",
    },
  );
}
