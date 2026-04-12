import { desc, eq, gte, sql } from "drizzle-orm";

import {
  createApplicationEvent,
  getApplicationRecordForJob,
  updateApplicationRecord,
  updateJobRecord,
} from "@/lib/applications/store";
import { db } from "@/lib/db/client";
import { insertRecordAsync } from "@/lib/db/store-helpers";
import { aiBudgetSettings, aiUsageEvents } from "@/lib/db/schema/integrations";
import { generatedDocuments } from "@/lib/db/schema/profiles";

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getTailoringBudgetContext() {
  const settings = await db
    .select()
    .from(aiBudgetSettings)
    .where(eq(aiBudgetSettings.id, 1))
    .get();

  const monthlySpendRow = await db
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

export async function getNextGeneratedDocumentVersion(jobId: number, documentType: string) {
  const latest = await db
    .select()
    .from(generatedDocuments)
    .where(
      sql`${generatedDocuments.jobId} = ${jobId} and ${generatedDocuments.documentType} = ${documentType}`,
    )
    .orderBy(desc(generatedDocuments.version))
    .get();

  return (latest?.version ?? 0) + 1;
}

export async function createGeneratedDocuments(
  values: Array<typeof generatedDocuments.$inferInsert>,
) {
  await insertRecordAsync(generatedDocuments, values);
}

export async function getTailoringApplication(jobId: number) {
  return await getApplicationRecordForJob(jobId);
}

export async function updateTailoringApplication(
  applicationId: number,
  values: Partial<typeof import("@/lib/db/schema/workflow").applications.$inferInsert>,
) {
  await updateApplicationRecord(applicationId, values);
}

export async function logTailoringApplicationEvent(input: {
  applicationId: number;
  payload: unknown;
}) {
  await createApplicationEvent({
    applicationId: input.applicationId,
    eventType: "drafts_linked",
    payload: input.payload,
  });
}

export async function updateTailoringJobStage(
  jobId: number,
  values: Partial<typeof import("@/lib/db/schema/jobs").jobs.$inferInsert>,
) {
  await updateJobRecord(jobId, values);
}

export async function logTailoringUsageEvent(
  values: typeof aiUsageEvents.$inferInsert,
) {
  await insertRecordAsync(aiUsageEvents, values);
}
