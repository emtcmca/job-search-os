import { getRuntimeEnvironmentSummary } from "@/lib/runtime/deployment";
import {
  getInboxConnectionRecord,
  updateInboxConnectionRecord,
} from "@/lib/inbox/store";

const gmailAuthBaseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const gmailTokenUrl = "https://oauth2.googleapis.com/token";
const gmailApiBaseUrl = "https://gmail.googleapis.com/gmail/v1/users/me";
const defaultSyncQuery =
  'newer_than:14d {application interview recruiter recruiting talent hiring candidate role position "next steps" "thank you for applying"} -category:promotions -category:social -category:forums';
const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";

type GmailTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
};

type GmailMessageListResponse = {
  messages?: Array<{
    id: string;
    threadId: string;
  }>;
};

type GmailHeader = {
  name: string;
  value: string;
};

type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

function getBaseUrl() {
  return getRuntimeEnvironmentSummary().appBaseUrl;
}

export function getGmailSetupStatus() {
  const runtime = getRuntimeEnvironmentSummary();
  const missingVars = [
    !process.env.GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_ID" : null,
    !process.env.GOOGLE_CLIENT_SECRET ? "GOOGLE_CLIENT_SECRET" : null,
    runtime.isHosted && !runtime.hasExplicitAppUrl ? "APP_URL" : null,
  ].filter(Boolean) as string[];
  const storageReady =
    runtime.database.kind === "libsql_hosted" ||
    (!runtime.isHosted && runtime.database.kind === "sqlite_file");
  const readyForLiveSync = missingVars.length === 0 && storageReady;

  return {
    configured: missingVars.length === 0,
    storageReady,
    readyForLiveSync,
    callbackUrl: new URL("/api/inbox/gmail/callback", getBaseUrl()).toString(),
    missingVars,
    defaultSyncQuery,
    runtimeLabel: runtime.runtimeLabel,
    appBaseUrlMessage: runtime.appBaseUrlMessage,
    storageMessage: storageReady
      ? runtime.database.kind === "libsql_hosted"
        ? "Gmail tokens and sync state can be stored safely in the hosted LibSQL/Turso database for this deployment."
        : "Gmail tokens and sync state can be stored safely in the local SQLite workspace on this machine."
      : "Gmail live sync is blocked here because the running app still uses local SQLite storage. Use the hosted migration scripts first, then switch the runtime in a later slice.",
  };
}

export function getRecommendedGmailSyncQuery() {
  return defaultSyncQuery;
}

function getGmailClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  return clientId;
}

function getGmailClientSecret() {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured.");
  }

  return clientSecret;
}

export function buildGmailAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: getGmailClientId(),
    redirect_uri: getGmailSetupStatus().callbackUrl,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: gmailScope,
    state,
  });

  return `${gmailAuthBaseUrl}?${params.toString()}`;
}

async function gmailFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gmail request failed (${response.status}): ${details}`);
  }

  return (await response.json()) as T;
}

export async function exchangeGmailCodeForTokens(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: getGmailClientId(),
    client_secret: getGmailClientSecret(),
    redirect_uri: getGmailSetupStatus().callbackUrl,
    grant_type: "authorization_code",
  });

  return gmailFetch<GmailTokenResponse>(gmailTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

export async function refreshGmailAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: getGmailClientId(),
    client_secret: getGmailClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  return gmailFetch<GmailTokenResponse>(gmailTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

export async function fetchGmailProfile(accessToken: string) {
  return gmailFetch<{ emailAddress: string; messagesTotal: number; threadsTotal: number }>(
    `${gmailApiBaseUrl}/profile`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export async function listGmailMessages(accessToken: string, query: string, maxResults = 25) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });

  return gmailFetch<GmailMessageListResponse>(`${gmailApiBaseUrl}/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  const params = new URLSearchParams({
    format: "full",
  });

  return gmailFetch<GmailMessageResponse>(
    `${gmailApiBaseUrl}/messages/${messageId}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function collectBodyParts(part?: GmailMessagePart): string[] {
  if (!part) {
    return [];
  }

  const segments: string[] = [];
  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (part.mimeType === "text/html") {
      segments.push(stripHtml(decoded));
    } else {
      segments.push(decoded);
    }
  }

  for (const child of part.parts ?? []) {
    segments.push(...collectBodyParts(child));
  }

  return segments;
}

export function extractGmailBodyText(message: GmailMessageResponse) {
  return collectBodyParts(message.payload)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function getGmailHeader(message: GmailMessageResponse, headerName: string) {
  const normalizedHeaderName = headerName.toLowerCase();
  return (
    message.payload?.headers?.find(
      (header) => header.name.toLowerCase() === normalizedHeaderName,
    )?.value ?? null
  );
}

export function parseGmailSender(fromHeader: string | null) {
  if (!fromHeader) {
    return {
      senderName: undefined,
      senderEmail: "",
    };
  }

  const emailMatch = fromHeader.match(/<([^>]+)>/);
  if (emailMatch) {
    const senderName = fromHeader.replace(emailMatch[0], "").replaceAll('"', "").trim();
    return {
      senderName: senderName || undefined,
      senderEmail: emailMatch[1].trim(),
    };
  }

  const fallbackEmailMatch = fromHeader.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (fallbackEmailMatch) {
    return {
      senderName: fromHeader.replace(fallbackEmailMatch[0], "").replaceAll('"', "").trim() || undefined,
      senderEmail: fallbackEmailMatch[0].trim(),
    };
  }

  return {
    senderName: undefined,
    senderEmail: fromHeader.trim(),
  };
}

export async function getFreshGmailAccessToken() {
  const connection = await getInboxConnectionRecord();
  if (!connection || connection.provider !== "gmail" || !connection.refreshToken) {
    throw new Error("Gmail is not connected yet.");
  }

  const now = Date.now();
  if (
    connection.accessToken &&
    connection.tokenExpiresAt &&
    new Date(connection.tokenExpiresAt).getTime() > now + 60 * 1000
  ) {
    return connection.accessToken;
  }

  const tokens = await refreshGmailAccessToken(connection.refreshToken);
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await updateInboxConnectionRecord(connection.id, {
    accessToken: tokens.access_token,
    tokenExpiresAt,
    updatedAt: new Date().toISOString(),
    lastSyncError: null,
  });

  return tokens.access_token;
}
