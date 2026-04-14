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

const companySuffixTokens = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "group",
  "holdings",
  "services",
  "systems",
  "solutions",
  "technologies",
  "technology",
  "tech",
]);

const titleStopwords = new Set([
  "and",
  "for",
  "from",
  "into",
  "lead",
  "manager",
  "of",
  "role",
  "senior",
  "staff",
  "team",
  "the",
  "with",
]);

function normalize(value: string) {
  return value.toLowerCase();
}

function tokenize(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function uniqueTokens(tokens: string[]) {
  return Array.from(new Set(tokens));
}

function compactText(input: InboxCaptureInput) {
  return normalize(
    [input.subject, input.snippet ?? "", input.bodyText ?? "", input.senderEmail].join(" "),
  );
}

function extractSenderDomain(senderEmail: string) {
  return normalize(senderEmail.split("@")[1] ?? "");
}

function companyTokens(name: string | null | undefined) {
  return uniqueTokens(
    tokenize(name ?? "").filter(
      (token) => token.length > 2 && !companySuffixTokens.has(token),
    ),
  );
}

function titleTokens(title: string | null | undefined) {
  return uniqueTokens(
    tokenize(title ?? "").filter(
      (token) => token.length > 2 && !titleStopwords.has(token),
    ),
  );
}

function countTokenMatches(haystack: string, tokens: string[]) {
  return tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
}

function hasDomainTokenMatch(senderEmail: string, tokens: string[]) {
  const senderDomain = extractSenderDomain(senderEmail);
  return tokens.some((token) => token.length > 2 && senderDomain.includes(token));
}

export function isLikelyJobSearchMessage(input: InboxCaptureInput) {
  const haystack = compactText(input);
  const senderDomain = extractSenderDomain(input.senderEmail);

  const positiveSignals = [
    /(application|candidate|career|hiring|interview|job|next steps|position|recruit|role|talent)/,
    /(ashby|bamboohr|dayforce|getro|greenhouse|icims|jobvite|lever|smartrecruiters|workday)/,
  ];
  const negativeSignals = [
    /(cart|coupon|discount|donation|order update|receipt|rewards|sale ends|security alert|shipping|unsubscribe|verify your email|welcome to)/,
    /(accounts\.google\.com|dunkin|microsoft\.com|solostove)/,
  ];

  const positiveMatch = positiveSignals.some((pattern) => pattern.test(haystack));
  const negativeMatch = negativeSignals.some(
    (pattern) => pattern.test(haystack) || pattern.test(senderDomain),
  );

  return positiveMatch || !negativeMatch;
}

export function classifyInboxMessage(input: InboxCaptureInput): InboxMessageType {
  const haystack = compactText(input);

  if (
    /(interview|phone screen|screening call|hiring manager|availability|schedule time|calendar|zoom|meet with|meet the team|onsite|on-site|take-home)/.test(
      haystack,
    )
  ) {
    return "interview";
  }

  if (
    /(regret to inform|unfortunately|not moving forward|other candidates|decline to move|rejection|won't be moving forward|unable to move ahead)/.test(
      haystack,
    )
  ) {
    return "rejection";
  }

  if (
    /(application received|application submitted|application has been received|received your application|submission confirmation|thank you for applying|thanks for applying|thank you for your interest)/.test(
      haystack,
    )
  ) {
    return "confirmation";
  }

  if (
    /(next steps|follow up|following up|our team|please reply|question about your application|recruiter|reviewed your application|would love to chat|would like to chat|would like to schedule|like to move forward)/.test(
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

  await createApplicationEvent({
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

  const application = await getApplicationRecord(input.applicationId);

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
    await updateApplicationRecord(input.applicationId, {
      status: nextStatus,
    });

    await updateJobRecord(input.jobId, {
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
    await createReminderRecord({
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

  const application = await getApplicationRecord(input.applicationId);
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
    const normalizedCompany = normalize(application.companyName ?? "");
    const senderEmail = normalize(input.senderEmail);
    const companyNameTokens = companyTokens(application.companyName);
    const jobTitleTokens = titleTokens(application.jobTitle);

    if (normalizedTitle && haystack.includes(normalizedTitle)) {
      score += 4;
    } else {
      score += Math.min(3, countTokenMatches(haystack, jobTitleTokens));
    }

    if (normalizedCompany && haystack.includes(normalizedCompany)) {
      score += 4;
    } else {
      score += Math.min(3, countTokenMatches(haystack, companyNameTokens));
    }

    if (hasDomainTokenMatch(senderEmail, companyNameTokens)) {
      score += 3;
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

  return best && best.score >= 5 ? best : null;
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
