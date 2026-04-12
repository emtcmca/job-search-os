import type { DraftPacket } from "@/lib/applications/draft-packet";
import type { applications } from "@/lib/db/schema/workflow";

type ApplicationRecord = typeof applications.$inferSelect;

type ChecklistItem = {
  key: string;
  label: string;
  complete: boolean;
  required: boolean;
};

export type ApplicationReadiness = {
  readyItems: ChecklistItem[];
  submissionRecordItems: ChecklistItem[];
  readyToSubmit: boolean;
  missingReadyItems: string[];
  submissionRecordComplete: boolean;
  missingSubmissionItems: string[];
};

export function getApplicationReadiness(
  application: ApplicationRecord | null | undefined,
  packet: DraftPacket,
): ApplicationReadiness {
  const readyItems: ChecklistItem[] = [
    {
      key: "packet_complete",
      label: "Preferred packet is complete",
      complete: packet.hasCompleteDraftPacket,
      required: true,
    },
    {
      key: "packet_linked",
      label: "Application is linked to the preferred packet",
      complete:
        packet.hasCompleteDraftPacket &&
        !packet.needsResumeRefresh &&
        !packet.needsCoverLetterRefresh,
      required: true,
    },
    {
      key: "platform_set",
      label: "Platform is set",
      complete: Boolean(application?.platform?.trim()),
      required: true,
    },
    {
      key: "submission_url",
      label: "Submission URL is saved",
      complete: Boolean(application?.submissionUrl?.trim()),
      required: true,
    },
    {
      key: "follow_up_plan",
      label: "Required follow-up instructions are captured",
      complete:
        !application?.followUpRequired || Boolean(application?.followUpInstructions?.trim()),
      required: Boolean(application?.followUpRequired),
    },
  ];

  const submissionRecordItems: ChecklistItem[] = [
    {
      key: "submitted_at",
      label: "Submitted timestamp is recorded",
      complete: Boolean(application?.submittedAt),
      required: true,
    },
    {
      key: "submission_reference",
      label: "Reference number is captured",
      complete: Boolean(application?.submissionReference?.trim()),
      required: true,
    },
    {
      key: "follow_up_plan",
      label: "Required follow-up instructions are captured",
      complete:
        !application?.followUpRequired || Boolean(application?.followUpInstructions?.trim()),
      required: Boolean(application?.followUpRequired),
    },
  ];

  const requiredReadyItems = readyItems.filter((item) => item.required);
  const requiredSubmissionItems = submissionRecordItems.filter((item) => item.required);

  return {
    readyItems,
    submissionRecordItems,
    readyToSubmit: requiredReadyItems.every((item) => item.complete),
    missingReadyItems: requiredReadyItems
      .filter((item) => !item.complete)
      .map((item) => item.label),
    submissionRecordComplete: requiredSubmissionItems.every((item) => item.complete),
    missingSubmissionItems: requiredSubmissionItems
      .filter((item) => !item.complete)
      .map((item) => item.label),
  };
}

export function inferApplicationWorkflowStatus(input: {
  currentStatus: string | null | undefined;
  readiness: ApplicationReadiness;
}) {
  if (
    input.currentStatus === "applied" ||
    input.currentStatus === "follow-up" ||
    input.currentStatus === "interview" ||
    input.currentStatus === "closed"
  ) {
    return input.currentStatus;
  }

  return input.readiness.readyToSubmit ? "ready" : "new";
}
