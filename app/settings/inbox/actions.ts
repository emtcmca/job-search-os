"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ingestInboxMessage,
  linkInboxMessageToApplication,
  markInboxMessageReviewed,
} from "@/lib/inbox/ingest";
import {
  disconnectGmailInbox,
  updateInboxConnectionSettings,
} from "@/lib/inbox/connection-store";
import { syncGmailInbox } from "@/lib/inbox/sync-gmail";
import { getGmailSetupStatus } from "@/lib/inbox/gmail";
import { getHostedPreviewWriteRedirect } from "@/lib/runtime/deployment";

const inboxSettingsPath = "/settings/inbox";

export async function updateInboxConnectionAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    inboxSettingsPath,
    "update inbox integration settings",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const provider = String(formData.get("provider") ?? "manual").trim();
  const monitoredAddress = String(formData.get("monitoredAddress") ?? "").trim();
  const forwardingAddress = String(formData.get("forwardingAddress") ?? "").trim();
  const connectionStatus = String(formData.get("connectionStatus") ?? "not_connected").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const syncQuery = String(formData.get("syncQuery") ?? "").trim();
  const isEnabled = formData.get("isEnabled") === "on";
  const autoCreateReminders = formData.get("autoCreateReminders") === "on";
  const notifyOnEmployerReplies = formData.get("notifyOnEmployerReplies") === "on";

  await updateInboxConnectionSettings({
    provider,
    monitoredAddress,
    forwardingAddress,
    connectionStatus,
    notes,
    syncQuery,
    isEnabled,
    autoCreateReminders,
    notifyOnEmployerReplies,
  });

  revalidatePath(inboxSettingsPath);
  redirect(
    `${inboxSettingsPath}?status=success&message=Inbox integration settings updated.` as never,
  );
}

export async function captureInboxMessageAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    inboxSettingsPath,
    "capture inbox messages",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await ingestInboxMessage({
    senderName: String(formData.get("senderName") ?? "").trim() || undefined,
    senderEmail: String(formData.get("senderEmail") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim(),
    snippet: String(formData.get("snippet") ?? "").trim() || undefined,
    bodyText: String(formData.get("bodyText") ?? "").trim() || undefined,
    receivedAt: String(formData.get("receivedAt") ?? "").trim() || undefined,
    sourceProvider: "manual",
  });

  revalidatePath(inboxSettingsPath);
  revalidatePath("/applications");
  revalidatePath("/jobs");

  redirect(
    `${inboxSettingsPath}?status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(
      result.message,
    )}` as never,
  );
}

export async function syncGmailInboxAction() {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    inboxSettingsPath,
    "sync Gmail inbox data",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const setup = getGmailSetupStatus();
  if (!setup.readyForLiveSync) {
    redirect(
      `${inboxSettingsPath}?status=error&message=${encodeURIComponent(
        setup.missingVars.length > 0
          ? `Gmail setup is incomplete. Missing: ${setup.missingVars.join(", ")}.`
          : setup.storageMessage,
      )}` as never,
    );
  }

  const result = await syncGmailInbox();

  revalidatePath(inboxSettingsPath);
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/jobs");

  redirect(
    `${inboxSettingsPath}?status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(
      result.message,
    )}` as never,
  );
}

export async function disconnectGmailInboxAction() {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    inboxSettingsPath,
    "disconnect Gmail",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await disconnectGmailInbox();

  revalidatePath(inboxSettingsPath);

  redirect(
    `${inboxSettingsPath}?status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(
      result.message,
    )}` as never,
  );
}

export async function markInboxMessageReviewedAction(formData: FormData) {
  const inboxMessageId = Number(formData.get("inboxMessageId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    inboxSettingsPath,
    "review inbox messages",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }
  const result =
    Number.isFinite(inboxMessageId) && inboxMessageId > 0
      ? await markInboxMessageReviewed(inboxMessageId)
      : { ok: false as const, message: "Inbox message could not be reviewed." };

  revalidatePath(inboxSettingsPath);
  revalidatePath("/");

  redirect(
    `${inboxSettingsPath}?status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(
      result.message,
    )}` as never,
  );
}

export async function linkInboxMessageToApplicationAction(formData: FormData) {
  const inboxMessageId = Number(formData.get("inboxMessageId"));
  const applicationId = Number(formData.get("applicationId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    inboxSettingsPath,
    "link inbox messages to applications",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result =
    Number.isFinite(inboxMessageId) &&
    inboxMessageId > 0 &&
    Number.isFinite(applicationId) &&
    applicationId > 0
      ? await linkInboxMessageToApplication({
          inboxMessageId,
          applicationId,
        })
      : { ok: false as const, message: "Select an application before linking this inbox message." };

  revalidatePath(inboxSettingsPath);
  revalidatePath("/");
  revalidatePath("/applications");
  revalidatePath("/jobs");

  redirect(
    `${inboxSettingsPath}?status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(
      result.message,
    )}` as never,
  );
}
