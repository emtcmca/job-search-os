import { randomUUID } from "node:crypto";

import {
  buildGmailAuthUrl,
  exchangeGmailCodeForTokens,
  fetchGmailProfile,
  getGmailSetupStatus,
} from "@/lib/inbox/gmail";
import {
  getInboxConnectionRecord,
  updateInboxConnectionRecord,
} from "@/lib/inbox/store";

export async function updateInboxConnectionSettings(input: {
  provider: string;
  monitoredAddress: string;
  forwardingAddress: string;
  connectionStatus: string;
  notes: string;
  syncQuery: string;
  isEnabled: boolean;
  autoCreateReminders: boolean;
  notifyOnEmployerReplies: boolean;
}) {
  await updateInboxConnectionRecord(1, {
    provider: input.provider || "manual",
    monitoredAddress: input.monitoredAddress || null,
    forwardingAddress: input.forwardingAddress || null,
    connectionStatus: input.connectionStatus || "not_connected",
    isEnabled: input.isEnabled,
    autoCreateReminders: input.autoCreateReminders,
    notifyOnEmployerReplies: input.notifyOnEmployerReplies,
    syncQuery: input.syncQuery || "newer_than:30d",
    notes: input.notes || null,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true as const,
    message: "Inbox integration settings updated.",
  };
}

export async function disconnectGmailInbox() {
  await updateInboxConnectionRecord(1, {
    connectionStatus: "not_connected",
    isEnabled: false,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    oauthStateToken: null,
    providerAccountEmail: null,
    lastSyncStatus: "idle",
    lastSyncError: null,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true as const,
    message: "Gmail connection cleared.",
  };
}

export async function beginGmailAuthorization() {
  const setup = getGmailSetupStatus();
  if (!setup.readyForLiveSync) {
    return {
      ok: false as const,
      message:
        setup.missingVars.length > 0
          ? `Gmail setup is incomplete. Missing: ${setup.missingVars.join(", ")}.`
          : setup.storageMessage,
      callbackUrl: setup.callbackUrl,
    };
  }

  const state = randomUUID();
  await updateInboxConnectionRecord(1, {
    provider: "gmail",
    connectionStatus: "ready_for_auth",
    oauthStateToken: state,
    lastSyncError: null,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true as const,
    authUrl: buildGmailAuthUrl(state),
  };
}

export async function finalizeGmailAuthorization(input: {
  code: string | null;
  state: string | null;
  error: string | null;
}) {
  const setup = getGmailSetupStatus();
  if (!setup.readyForLiveSync) {
    return {
      ok: false as const,
      message:
        setup.missingVars.length > 0
          ? `Gmail setup is incomplete. Missing: ${setup.missingVars.join(", ")}.`
          : setup.storageMessage,
      callbackUrl: setup.callbackUrl,
    };
  }

  const connection = await getInboxConnectionRecord();
  if (!connection) {
    return {
      ok: false as const,
      message: "Inbox connection record is missing.",
      callbackUrl: setup.callbackUrl,
    };
  }

  if (input.error) {
    await updateInboxConnectionRecord(connection.id, {
      connectionStatus: "not_connected",
      oauthStateToken: null,
      lastSyncError: `Gmail authorization failed: ${input.error}`,
      updatedAt: new Date().toISOString(),
    });

    return {
      ok: false as const,
      message: "Gmail authorization was cancelled or failed.",
      callbackUrl: setup.callbackUrl,
    };
  }

  if (!input.code || !input.state || !connection.oauthStateToken || connection.oauthStateToken !== input.state) {
    return {
      ok: false as const,
      message: "Gmail callback could not be verified.",
      callbackUrl: setup.callbackUrl,
    };
  }

  try {
    const tokens = await exchangeGmailCodeForTokens(input.code);
    const profile = await fetchGmailProfile(tokens.access_token);

    await updateInboxConnectionRecord(connection.id, {
      provider: "gmail",
      monitoredAddress: profile.emailAddress,
      providerAccountEmail: profile.emailAddress,
      connectionStatus: "connected",
      isEnabled: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? connection.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      oauthStateToken: null,
      lastSyncStatus: "connected",
      lastSyncError: null,
      updatedAt: new Date().toISOString(),
    });

    return {
      ok: true as const,
      message: "Gmail connected. You can run a sync now.",
      callbackUrl: setup.callbackUrl,
    };
  } catch (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Gmail authorization failed during token exchange.";

    await updateInboxConnectionRecord(connection.id, {
      connectionStatus: "not_connected",
      oauthStateToken: null,
      lastSyncStatus: "error",
      lastSyncError: message,
      updatedAt: new Date().toISOString(),
    });

    return {
      ok: false as const,
      message,
      callbackUrl: setup.callbackUrl,
    };
  }
}
