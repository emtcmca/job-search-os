import {
  createApplicationEvent,
  createReminderRecord,
  getApplicationRecord,
  updateApplicationRecord,
  updateJobRecord,
} from "@/lib/applications/store";
import {
  createInboxMessageRecord,
  getInboxConnectionRecord,
  getInboxMessageByExternalKey,
  getInboxMessageRecord,
  listInboxMatchCandidates,
  updateInboxConnectionRecord,
  updateInboxMessageRecord,
} from "@/lib/inbox/store";

export type InboxMessageType =
  | "confirmation"
  | "employer_reply"
  | "interview"
  | "rejection"
  | "other";

type InboxCaptureInput = {
  senderName?: string;
  senderEmail: string;
  subject: string;
  snippet?: string;
  bodyText?: string;
  receivedAt?: string;
  sourceProvider?: string;
  externalMessageId?: string;
  threadId?: string;
};

function normalize(value: string) {
  return value.toLowerCase();
}

function compactText(input: InboxCaptureInput) {
  return normalize(
    [input.subject, input.snippet ?? "", input.bodyText ?? "", input.senderEmail].join(" "),
  );
}

export function classifyInboxMessage(input: InboxCaptureInput): InboxMessageType {
  const haystack = compactText(input);

  if (
    /(interview|phone screen|hiring manager|availability|schedule time|calendar|zoom|meet with)/.test(
      haystack,
    )
  ) {
    return "interview";
  }

  if (
    /(regret to inform|unfortunately|not moving forward|other candidates|decline to move|rejection)/.test(
      haystack,
    )
  ) {
    return "rejection";
  }

  if (
    /(application received|thanks for applying|thank you for applying|received your application|application has been received|submission confirmation)/.test(
      haystack,
    )
  ) {
    return "confirmation";
  }

  if (
    /(next steps|follow up|following up|would love to chat|please reply|reach out|question about your application|recruiter)/.test(
      haystack,
    )
  ) {
    return "employer_reply";
  }

  return "other";
}

async function applyInboxMessageWorkflow(input: {
  applicationId: number;
  jobId: number;
  messageType: InboxMessageType;
  subject: string;
  senderName?: string;
  senderEmail: string;
  details?: string | null;
  occurredAtIso: string;
  inboxMessageId: number;
  source?: string;
  autoCreateReminder?: boolean;
}) {
  const eventTypeMap: Record<InboxMessageType, string> = {
    confirmation: "application_confirmation_received",
    employer_reply: "employer_reply_received",
    interview: "interview_requested",
    rejection: "rejection_received",
    other: "inbox_message_logged",
  };
  const eventType = eventTypeMap[input.messageType];

  createApplicationEvent({
    applicationId: input.applicationId,
    eventType,
    payload: {
      summary: input.subject,
      details: input.details ?? null,
      occurredAt: input.occurredAtIso,
      source: input.source ?? "inbox",
      senderName: input.senderName?.trim() || null,
      senderEmail: input.senderEmail.trim(),
      inboxMessageId: input.inboxMessageId,
      messageType: input.messageType,
    },
  });

  const application = getApplicationRecord(input.applicationId);

  const nextStatus =
    input.messageType === "interview"
      ? "interview"
      : input.messageType === "rejection"
        ? "closed"
        : input.messageType === "confirmation" &&
            application &&
            ["new", "review", "tailoring", "ready"].includes(application.status)
          ? "applied"
          : null;

  if (nextStatus) {
    updateApplicationRecord(input.applicationId, {
      status: nextStatus,
    });

    updateJobRecord(input.jobId, {
      currentStage:
        nextStatus === "interview"
          ? "interview"
          : nextStatus === "closed"
            ? "closed"
            : "applied",
      updatedAt: new Date().toISOString(),
    });
  }

  if (input.autoCreateReminder && input.messageType !== "confirmation") {
    createReminderRecord({
      applicationId: input.applicationId,
      jobId: input.jobId,
      title: `Review inbox message: ${input.subject}`,
      dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  }
}

export async function markInboxMessageReviewed(messageId: number) {
  const message = await getInboxMessageRecord(messageId);
  if (!message) {
    return {
      ok: false as const,
      message: "Inbox message not found.",
    };
  }

  await updateInboxMessageRecord(messageId, {
    reviewedAt: new Date().toISOString(),
    processingNotes:
      message.processingNotes ??
      "Reviewed by the user from the inbox workspace.",
  });

  return {
    ok: true as const,
    message: "Inbox message marked as reviewed.",
  };
}

export async function linkInboxMessageToApplication(input: {
  inboxMessageId: number;
  applicationId: number;
}) {
  const connection = await getInboxConnectionRecord();
  const message = await getInboxMessageRecord(input.inboxMessageId);
  if (!message) {
    return {
      ok: false as const,
      message: "Inbox message not found.",
    };
  }

  const application = getApplicationRecord(input.applicationId);
  if (!application) {
    return {
      ok: false as const,
      message: "Application record not found.",
    };
  }

  await updateInboxMessageRecord(message.id, {
    applicationId: application.id,
    jobId: application.jobId,
    matchedStatus: "matched",
    processingNotes: "Manually linked to an application record from the inbox workspace.",
  });

  await applyInboxMessageWorkflow({
    applicationId: application.id,
    jobId: application.jobId,
    messageType: message.messageType as InboxMessageType,
    subject: message.subject,
    senderName: message.senderName ?? undefined,
    senderEmail: message.senderEmail,
    details: message.bodyText ?? message.snippet,
    occurredAtIso: message.receivedAt,
    inboxMessageId: message.id,
    source: "inbox_manual_link",
    autoCreateReminder: connection?.autoCreateReminders,
  });

  return {
    ok: true as const,
    message: "Inbox message linked to an application.",
  };
}

function companyToken(name: string | null | undefined) {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function inferMatch(input: InboxCaptureInput) {
  const haystack = compactText(input);
  const applicationRows = await listInboxMatchCandidates();

  let best:
    | {
        applicationId: number;
        jobId: number;
        score: number;
      }
    | undefined;

  for (const application of applicationRows) {
    if (!application.jobTitle) {
      continue;
    }

    let score = 0;

    const normalizedTitle = normalize(application.jobTitle);
    const normalizedCompany = companyToken(application.companyName);
    const senderEmail = normalize(input.senderEmail);

    if (normalizedTitle && haystack.includes(normalizedTitle)) {
      score += 4;
    }

    if (normalizedCompany && haystack.includes(normalizedCompany)) {
      score += 4;
    }

    if (
      normalizedCompany &&
      normalizedCompany.split(" ").some((token) => token.length > 3 && senderEmail.includes(token))
    ) {
      score += 2;
    }

    if (
      application.applicationStatus === "applied" ||
      application.applicationStatus === "follow-up"
    ) {
      score += 1;
    }

    if (!best || score > best.score) {
      best = {
        applicationId: application.applicationId,
        jobId: application.jobId,
        score,
      };
    }
  }

  return best && best.score >= 4 ? best : null;
}

export async function ingestInboxMessage(input: InboxCaptureInput) {
  const connection = await getInboxConnectionRecord();
  const sourceProvider = input.sourceProvider ?? connection?.provider ?? "manual";
  const existingMessage =
    input.externalMessageId && sourceProvider
      ? await getInboxMessageByExternalKey(sourceProvider, input.externalMessageId)
      : null;

  if (existingMessage) {
    return {
      ok: true as const,
      duplicate: true as const,
      matched: existingMessage.applicationId
        ? {
            applicationId: existingMessage.applicationId,
            jobId: existingMessage.jobId ?? 0,
            score: 0,
          }
        : null,
      message: "Inbox message was already logged.",
    };
  }

  const matched = await inferMatch(input);
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();
  const messageType = classifyInboxMessage(input);

  if (Number.isNaN(receivedAt.getTime())) {
    return {
      ok: false as const,
      message: "Inbox message could not be logged because the received date is invalid.",
    };
  }

  const inboxMessageId = await createInboxMessageRecord({
    applicationId: matched?.applicationId ?? null,
    jobId: matched?.jobId ?? null,
    sourceProvider,
    externalMessageId: input.externalMessageId ?? null,
    threadId: input.threadId ?? null,
    senderName: input.senderName?.trim() || null,
    senderEmail: input.senderEmail.trim(),
    subject: input.subject.trim(),
    snippet: input.snippet?.trim() || null,
    bodyText: input.bodyText?.trim() || null,
    receivedAt: receivedAt.toISOString(),
    messageType,
    matchedStatus: matched ? "matched" : "unmatched",
    reviewedAt: null,
    processingNotes: matched
      ? "Matched to an application record using company/title heuristics."
      : "No application match was confident enough yet.",
  });

  if (!inboxMessageId) {
    return {
      ok: false as const,
      message: "Inbox message could not be stored.",
    };
  }

  if (connection) {
    await updateInboxConnectionRecord(connection.id, {
      lastIngestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (matched) {
    await applyInboxMessageWorkflow({
      applicationId: matched.applicationId,
      jobId: matched.jobId,
      messageType,
      subject: input.subject.trim(),
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      details: input.bodyText?.trim() || input.snippet?.trim() || null,
      occurredAtIso: receivedAt.toISOString(),
      inboxMessageId,
      source: "inbox",
      autoCreateReminder: connection?.autoCreateReminders,
    });
  }

  return {
    ok: true as const,
    matched,
    duplicate: false as const,
    messageType,
    message: matched
      ? "Inbox message logged and matched to an application."
      : "Inbox message logged, but no application match was found yet.",
  };
}
