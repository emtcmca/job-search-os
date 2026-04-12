import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { generatedDocuments } from "@/lib/db/schema/profiles";
import { applications } from "@/lib/db/schema/workflow";

type ApplicationRecord = typeof applications.$inferSelect;
type GeneratedDocumentRecord = typeof generatedDocuments.$inferSelect;

export type DraftPacket = {
  documents: GeneratedDocumentRecord[];
  latestResumeStrategy: GeneratedDocumentRecord | null;
  latestCoverLetter: GeneratedDocumentRecord | null;
  approvedResumeStrategy: GeneratedDocumentRecord | null;
  approvedCoverLetter: GeneratedDocumentRecord | null;
  preferredResumeStrategy: GeneratedDocumentRecord | null;
  preferredCoverLetter: GeneratedDocumentRecord | null;
  linkedResumeStrategy: GeneratedDocumentRecord | null;
  linkedCoverLetter: GeneratedDocumentRecord | null;
  missingDocuments: string[];
  hasAnyDrafts: boolean;
  hasApprovedPacket: boolean;
  hasCompleteLatestPacket: boolean;
  hasCompleteDraftPacket: boolean;
  needsResumeRefresh: boolean;
  needsCoverLetterRefresh: boolean;
};

export async function listJobDocuments(jobId: number) {
  return await db
    .select()
    .from(generatedDocuments)
    .where(eq(generatedDocuments.jobId, jobId))
    .orderBy(desc(generatedDocuments.createdAt), desc(generatedDocuments.version))
    .all();
}

export function buildDraftPacket(
  documents: GeneratedDocumentRecord[],
  application?: ApplicationRecord | null,
): DraftPacket {
  const latestResumeStrategy =
    documents.find((document) => document.documentType === "resume_strategy") ?? null;
  const latestCoverLetter =
    documents.find((document) => document.documentType === "cover_letter") ?? null;
  const approvedResumeStrategy =
    documents.find(
      (document) =>
        document.documentType === "resume_strategy" &&
        document.approvalState === "approved",
    ) ?? null;
  const approvedCoverLetter =
    documents.find(
      (document) =>
        document.documentType === "cover_letter" &&
        document.approvalState === "approved",
    ) ?? null;
  const preferredResumeStrategy = approvedResumeStrategy ?? latestResumeStrategy;
  const preferredCoverLetter = approvedCoverLetter ?? latestCoverLetter;
  const linkedResumeStrategy = application?.resumeDocId
    ? documents.find((document) => document.id === application.resumeDocId) ?? null
    : null;
  const linkedCoverLetter = application?.coverLetterDocId
    ? documents.find((document) => document.id === application.coverLetterDocId) ?? null
    : null;
  const missingDocuments = [
    ...(preferredResumeStrategy ? [] : ["resume strategy"]),
    ...(preferredCoverLetter ? [] : ["cover letter"]),
  ];

  return {
    documents,
    latestResumeStrategy,
    latestCoverLetter,
    approvedResumeStrategy,
    approvedCoverLetter,
    preferredResumeStrategy,
    preferredCoverLetter,
    linkedResumeStrategy,
    linkedCoverLetter,
    missingDocuments,
    hasAnyDrafts: Boolean(latestResumeStrategy || latestCoverLetter),
    hasApprovedPacket: Boolean(approvedResumeStrategy && approvedCoverLetter),
    hasCompleteLatestPacket: Boolean(latestResumeStrategy && latestCoverLetter),
    hasCompleteDraftPacket: Boolean(preferredResumeStrategy && preferredCoverLetter),
    needsResumeRefresh:
      Boolean(application) &&
      Boolean(preferredResumeStrategy) &&
      preferredResumeStrategy?.id !== application?.resumeDocId,
    needsCoverLetterRefresh:
      Boolean(application) &&
      Boolean(preferredCoverLetter) &&
      preferredCoverLetter?.id !== application?.coverLetterDocId,
  };
}

export async function getDraftPacketForJob(
  jobId: number,
  application?: ApplicationRecord | null,
): Promise<DraftPacket> {
  return buildDraftPacket(await listJobDocuments(jobId), application);
}

export function inferJobStageFromPacket(input: {
  currentStage: string;
  applicationStatus?: string | null;
  packet: DraftPacket;
}) {
  switch (input.applicationStatus) {
    case "applied":
      return "applied";
    case "follow-up":
      return "follow-up";
    case "interview":
      return "interview";
    case "closed":
      return "closed";
    case "ready":
      return input.packet.hasCompleteDraftPacket ? "ready" : "tailoring";
    case "new":
      return input.packet.hasAnyDrafts ? "tailoring" : "review";
    default:
      break;
  }

  if (input.currentStage === "closed") {
    return "closed";
  }

  if (input.packet.hasAnyDrafts) {
    return "tailoring";
  }

  return input.currentStage === "new" ? "review" : input.currentStage;
}
