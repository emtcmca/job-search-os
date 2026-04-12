import {
  extractGmailBodyText,
  fetchGmailProfile,
  getFreshGmailAccessToken,
  getGmailHeader,
  getGmailMessage,
  getGmailSetupStatus,
  listGmailMessages,
  parseGmailSender,
} from "@/lib/inbox/gmail";
import { ingestInboxMessage } from "@/lib/inbox/ingest";
import { getInboxConnection } from "@/lib/inbox/queries";
import { updateInboxConnectionRecord } from "@/lib/inbox/store";

export async function syncGmailInbox() {
  const setup = getGmailSetupStatus();
  if (!setup.readyForLiveSync) {
    return {
      ok: false as const,
      message: setup.storageReady
        ? `Gmail sync is not ready yet. Missing: ${setup.missingVars.join(", ")}.`
        : setup.storageMessage,
    };
  }

  const connection = await getInboxConnection();
  if (!connection || connection.provider !== "gmail" || connection.connectionStatus !== "connected") {
    return {
      ok: false as const,
      message: "Connect Gmail before running a sync.",
    };
  }

  await updateInboxConnectionRecord(connection.id, {
    lastSyncStartedAt: new Date().toISOString(),
    lastSyncStatus: "syncing",
    lastSyncError: null,
    updatedAt: new Date().toISOString(),
  });

  try {
    const accessToken = await getFreshGmailAccessToken();
    const profile = await fetchGmailProfile(accessToken);
    const query = connection.syncQuery?.trim() || "newer_than:30d";
    const messageList = await listGmailMessages(accessToken, query, 25);

    let imported = 0;
    let duplicates = 0;
    let matched = 0;
    let latestReceivedAt: string | null = null;

    for (const messageRef of messageList.messages ?? []) {
      const message = await getGmailMessage(accessToken, messageRef.id);
      const fromHeader = getGmailHeader(message, "From");
      const subject = getGmailHeader(message, "Subject") ?? "(no subject)";
      const sender = parseGmailSender(fromHeader);

      if (!sender.senderEmail) {
        continue;
      }

      const result = await ingestInboxMessage({
        senderName: sender.senderName,
        senderEmail: sender.senderEmail,
        subject,
        snippet: message.snippet,
        bodyText: extractGmailBodyText(message) || message.snippet,
        receivedAt: message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : undefined,
        sourceProvider: "gmail",
        externalMessageId: message.id,
        threadId: message.threadId,
      });

      if (result.duplicate) {
        duplicates += 1;
      } else if (result.ok) {
        imported += 1;
        if (result.matched) {
          matched += 1;
        }
      }

      if (message.internalDate) {
        const receivedAt = new Date(Number(message.internalDate)).toISOString();
        if (!latestReceivedAt || receivedAt > latestReceivedAt) {
          latestReceivedAt = receivedAt;
        }
      }
    }

    await updateInboxConnectionRecord(connection.id, {
      monitoredAddress: connection.monitoredAddress || profile.emailAddress,
      providerAccountEmail: profile.emailAddress,
      lastIngestedAt: latestReceivedAt ?? connection.lastIngestedAt,
      lastSyncCompletedAt: new Date().toISOString(),
      lastSyncStatus: "connected",
      lastSyncError: null,
      syncCursor: latestReceivedAt ?? connection.syncCursor,
      updatedAt: new Date().toISOString(),
    });

    return {
      ok: true as const,
      message: `Gmail sync complete. ${imported} imported, ${duplicates} duplicates skipped, ${matched} matched.`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gmail sync failed for an unknown reason.";

    await updateInboxConnectionRecord(connection.id, {
      lastSyncCompletedAt: new Date().toISOString(),
      lastSyncStatus: "error",
      lastSyncError: message,
      updatedAt: new Date().toISOString(),
    });

    return {
      ok: false as const,
      message,
    };
  }
}
