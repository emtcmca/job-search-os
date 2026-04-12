import { desc, eq, gte, sql } from "drizzle-orm";

import {
  createApplicationEvent,
  getApplicationRecordForJob,
  updateApplicationRecord,
  updateJobRecord,
} from "@/lib/applications/store";
import { db } from "@/lib/db/client";
import { insertRecord } from "@/lib/db/store-helpers";
import { aiBudgetSettings, aiUsageEvents } from "@/lib/db/schema/integrations";
import { generatedDocuments } from "@/lib/db/schema/profiles";

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function getTailoringBudgetContext() {
  const settings = db
    .select()
    .from(aiBudgetSettings)
    .where(eq(aiBudgetSettings.id, 1))
    .get();

  const monthlySpendRow = db
    .select({
      spent: sql<number>`coalesce(sum(${aiUsageEvents.actualCost}), 0)`,
    })
    .from(aiUsageEvents)
    .where(gte(aiUsageEvents.createdAt, monthStartIso()))
    .get();

  return {
    settings,
    currentSpend: monthlySpendRow?.spent ?? 0,
  };
}

export function getNextGeneratedDocumentVersion(jobId: number, documentType: string) {
  const latest = db
    .select()
    .from(generatedDocuments)
    .where(
      sql`${generatedDocuments.jobId} = ${jobId} and ${generatedDocuments.documentType} = ${documentType}`,
    )
    .orderBy(desc(generatedDocuments.version))
    .get();

  return (latest?.version ?? 0) + 1;
}

export function createGeneratedDocuments(
  values: Array<typeof generatedDocuments.$inferInsert>,
) {
  insertRecord(generatedDocuments, values);
}

export function getTailoringApplication(jobId: number) {
  return getApplicationRecordForJob(jobId);
}

export function updateTailoringApplication(
  applicationId: number,
  values: Partial<typeof import("@/lib/db/schema/workflow").applications.$inferInsert>,
) {
  updateApplicationRecord(applicationId, values);
}

export function logTailoringApplicationEvent(input: {
  applicationId: number;
  payload: unknown;
}) {
  createApplicationEvent({
    applicationId: input.applicationId,
    eventType: "drafts_linked",
    payload: input.payload,
  });
}

export function updateTailoringJobStage(
  jobId: number,
  values: Partial<typeof import("@/lib/db/schema/jobs").jobs.$inferInsert>,
) {
  updateJobRecord(jobId, values);
}

export function logTailoringUsageEvent(
  values: typeof aiUsageEvents.$inferInsert,
) {
  insertRecord(aiUsageEvents, values);
}
