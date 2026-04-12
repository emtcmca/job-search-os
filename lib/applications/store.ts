import { and, eq, ne } from "drizzle-orm";

import {
  insertRecord,
  insertRecordReturning,
  selectFirstByColumn,
  updateRecordByColumn,
  updateRecordWhere,
} from "@/lib/db/store-helpers";
import { jobs } from "@/lib/db/schema/jobs";
import { generatedDocuments } from "@/lib/db/schema/profiles";
import { applicationEvents, applications, reminders } from "@/lib/db/schema/workflow";

export type JobRecord = typeof jobs.$inferSelect;
export type ApplicationRecord = typeof applications.$inferSelect;
export type GeneratedDocumentRecord = typeof generatedDocuments.$inferSelect;

export function getJobRecord(jobId: number) {
  return selectFirstByColumn(jobs, jobs.id, jobId) as JobRecord | undefined;
}

export function getApplicationRecord(applicationId: number) {
  return selectFirstByColumn(applications, applications.id, applicationId) as
    | ApplicationRecord
    | undefined;
}

export function getApplicationRecordForJob(jobId: number) {
  return selectFirstByColumn(applications, applications.jobId, jobId) as
    | ApplicationRecord
    | undefined;
}

export function createApplicationRecord(values: typeof applications.$inferInsert) {
  const inserted = insertRecordReturning(applications, values, {
    id: applications.id,
  }) as { id: number } | undefined;
  return inserted?.id;
}

export function updateApplicationRecord(
  applicationId: number,
  values: Partial<typeof applications.$inferInsert>,
) {
  updateRecordByColumn(applications, applications.id, applicationId, values);
}

export function createApplicationEvent(input: {
  applicationId: number;
  eventType: string;
  payload: unknown;
}) {
  insertRecord(applicationEvents, {
    applicationId: input.applicationId,
    eventType: input.eventType,
    payloadJson: JSON.stringify(input.payload),
  });
}

export function createReminderRecord(input: {
  applicationId: number;
  jobId: number;
  title: string;
  dueAt: string;
}) {
  insertRecord(reminders, {
    applicationId: input.applicationId,
    jobId: input.jobId,
    title: input.title,
    dueAt: input.dueAt,
    status: "open",
  });
}

export function updateJobRecord(
  jobId: number,
  values: Partial<typeof jobs.$inferInsert>,
) {
  updateRecordByColumn(jobs, jobs.id, jobId, values);
}

export function getGeneratedDocumentRecord(documentId: number) {
  return selectFirstByColumn(
    generatedDocuments,
    generatedDocuments.id,
    documentId,
  ) as GeneratedDocumentRecord | undefined;
}

export function updateGeneratedDocumentRecord(
  documentId: number,
  values: Partial<typeof generatedDocuments.$inferInsert>,
) {
  updateRecordByColumn(generatedDocuments, generatedDocuments.id, documentId, values);
}

export function supersedeApprovedDocuments(input: {
  jobId: number;
  documentType: string;
  exceptDocumentId: number;
}) {
  updateRecordWhere(
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
