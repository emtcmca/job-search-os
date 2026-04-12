import {
  getInboxConnectionRecord,
  listInboxLinkOptionRows,
  listInboxMessageRows,
} from "@/lib/inbox/store";

export async function getInboxConnection() {
  return getInboxConnectionRecord();
}

export async function listInboxMessages() {
  const rows = await listInboxMessageRows();

  return rows.map((row) => ({
    message: row.message,
    application: row.application,
    job: row.job,
    company: row.company,
  }));
}

export async function listInboxLinkOptions() {
  const rows = await listInboxLinkOptionRows();

  return rows.map((row) => ({
    applicationId: row.applicationId,
    jobId: row.jobId,
    label: `${row.companyName ?? "Unknown company"} | ${row.jobTitle ?? "Unknown job"} | ${row.applicationStatus}`,
  }));
}

export async function getInboxSummary() {
  const rows = await listInboxMessages();
  const actionableTypes = new Set([
    "confirmation",
    "employer_reply",
    "interview",
    "rejection",
  ]);
  const actionable = rows.filter((row) => actionableTypes.has(row.message.messageType));
  const unreviewed = rows.filter((row) => !row.message.reviewedAt);
  const attentionQueue = rows
    .filter(
      (row) =>
        row.message.matchedStatus === "matched" &&
        !row.message.reviewedAt &&
        actionableTypes.has(row.message.messageType),
    )
    .slice(0, 5);
  const unreviewedActionable = rows.filter(
    (row) =>
      row.message.matchedStatus === "matched" &&
      !row.message.reviewedAt &&
      actionableTypes.has(row.message.messageType),
  ).length;

  return {
    total: rows.length,
    matched: rows.filter((row) => row.message.matchedStatus === "matched").length,
    unmatched: rows.filter((row) => row.message.matchedStatus !== "matched").length,
    unreviewedTotal: unreviewed.length,
    unreviewedActionable,
    attentionQueue,
    recentReplies: rows.filter((row) => row.message.matchedStatus === "matched").slice(0, 5),
    recentUnmatched: rows
      .filter((row) => row.message.matchedStatus !== "matched" && !row.message.reviewedAt)
      .slice(0, 5),
    typeCounts: {
      confirmation: rows.filter((row) => row.message.messageType === "confirmation").length,
      employerReply: rows.filter((row) => row.message.messageType === "employer_reply").length,
      interview: rows.filter((row) => row.message.messageType === "interview").length,
      rejection: rows.filter((row) => row.message.messageType === "rejection").length,
      other: rows.filter((row) => row.message.messageType === "other").length,
    },
    actionableCount: actionable.length,
  };
}
