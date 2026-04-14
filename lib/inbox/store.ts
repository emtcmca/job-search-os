import { and, desc, eq, isNull, ne, or } from "drizzle-orm";

import {
  insertRecordReturningAsync,
  selectAllWithBuilderAsync,
  selectFirstByColumnAsync,
  selectFirstWithBuilderAsync,
  updateRecordByColumnAsync,
} from "@/lib/db/store-helpers";
import { companies } from "@/lib/db/schema/companies";
import { inboxConnections, inboxMessages } from "@/lib/db/schema/integrations";
import { jobs } from "@/lib/db/schema/jobs";
import { applications } from "@/lib/db/schema/workflow";

export type InboxConnectionRecord = typeof inboxConnections.$inferSelect;
export type InboxMessageRecord = typeof inboxMessages.$inferSelect;

export async function getInboxConnectionRecord() {
  return (await selectFirstByColumnAsync(
    inboxConnections,
    inboxConnections.id,
    1,
  )) as
    | InboxConnectionRecord
    | undefined;
}

export async function updateInboxConnectionRecord(
  connectionId: number,
  values: Partial<typeof inboxConnections.$inferInsert>,
) {
  await updateRecordByColumnAsync(
    inboxConnections,
    inboxConnections.id,
    connectionId,
    values,
  );
}

export async function getInboxMessageRecord(messageId: number) {
  return (await selectFirstByColumnAsync(
    inboxMessages,
    inboxMessages.id,
    messageId,
  )) as
    | InboxMessageRecord
    | undefined;
}

export async function getInboxMessageByExternalKey(
  sourceProvider: string,
  externalMessageId: string,
) {
  return (await selectFirstWithBuilderAsync((database) =>
    database
      .select()
      .from(inboxMessages)
      .where(
        and(
          eq(inboxMessages.sourceProvider, sourceProvider),
          eq(inboxMessages.externalMessageId, externalMessageId),
        ),
      ),
  )) as InboxMessageRecord | undefined;
}

export async function createInboxMessageRecord(values: typeof inboxMessages.$inferInsert) {
  const inserted = (await insertRecordReturningAsync(inboxMessages, values, {
    id: inboxMessages.id,
  })) as { id: number } | undefined;
  return inserted?.id;
}

export async function updateInboxMessageRecord(
  messageId: number,
  values: Partial<typeof inboxMessages.$inferInsert>,
) {
  await updateRecordByColumnAsync(
    inboxMessages,
    inboxMessages.id,
    messageId,
    values,
  );
}

export async function listInboxMessageRows() {
  return (await selectAllWithBuilderAsync((database) =>
    database
      .select({
        message: inboxMessages,
        application: applications,
        job: jobs,
        company: companies,
      })
      .from(inboxMessages)
      .leftJoin(applications, eq(applications.id, inboxMessages.applicationId))
      .leftJoin(
        jobs,
        or(
          eq(jobs.id, inboxMessages.jobId),
          and(isNull(inboxMessages.jobId), eq(jobs.id, applications.jobId)),
        ),
      )
      .leftJoin(companies, eq(companies.id, jobs.companyId))
      .orderBy(desc(inboxMessages.receivedAt)),
  )) as Array<{
    message: typeof inboxMessages.$inferSelect;
    application: typeof applications.$inferSelect | null;
    job: typeof jobs.$inferSelect | null;
    company: typeof companies.$inferSelect | null;
  }>;
}

export async function listInboxLinkOptionRows() {
  return (await selectAllWithBuilderAsync((database) =>
    database
      .select({
        applicationId: applications.id,
        jobId: applications.jobId,
        applicationStatus: applications.status,
        jobTitle: jobs.title,
        companyName: companies.name,
      })
      .from(applications)
      .leftJoin(jobs, eq(jobs.id, applications.jobId))
      .leftJoin(companies, eq(companies.id, jobs.companyId))
      .orderBy(desc(applications.id)),
  )) as Array<{
    applicationId: number;
    jobId: number;
    applicationStatus: string;
    jobTitle: string | null;
    companyName: string | null;
  }>;
}

export async function listInboxJobLinkOptionRows() {
  return (await selectAllWithBuilderAsync((database) =>
    database
      .select({
        jobId: jobs.id,
        jobStage: jobs.currentStage,
        jobTitle: jobs.title,
        companyName: companies.name,
      })
      .from(jobs)
      .leftJoin(companies, eq(companies.id, jobs.companyId))
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .where(
        and(
          isNull(applications.id),
          eq(jobs.isRejected, false),
          ne(jobs.currentStage, "closed"),
        ),
      )
      .orderBy(desc(jobs.discoveredAt)),
  )) as Array<{
    jobId: number;
    jobStage: string;
    jobTitle: string | null;
    companyName: string | null;
  }>;
}

export async function listInboxMatchCandidates() {
  return (await selectAllWithBuilderAsync((database) =>
    database
      .select({
        applicationId: applications.id,
        jobId: applications.jobId,
        applicationStatus: applications.status,
        jobTitle: jobs.title,
        companyName: companies.name,
      })
      .from(applications)
      .leftJoin(jobs, eq(jobs.id, applications.jobId))
      .leftJoin(companies, eq(companies.id, jobs.companyId)),
  )) as Array<{
    applicationId: number;
    jobId: number;
    applicationStatus: string;
    jobTitle: string | null;
    companyName: string | null;
  }>;
}
