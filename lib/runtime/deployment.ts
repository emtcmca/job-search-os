import { resolve } from "node:path";

const defaultLocalSqliteRelativePath = "data/job-search.sqlite";
const defaultHostedSqlitePath = "/tmp/job-search.sqlite";
const supportedRemoteProtocols = new Set(["libsql:", "https:", "http:", "ws:", "wss:"]);

function tryParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function stripFileProtocol(value: string) {
  if (value.toLowerCase().startsWith("file://")) {
    return value.slice("file://".length);
  }

  if (value.toLowerCase().startsWith("file:")) {
    return value.slice("file:".length);
  }

  return value;
}

export function getConfiguredDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || defaultLocalSqliteRelativePath;
}

function isHostedRuntime() {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.VERCEL_ENV) ||
    Boolean(process.env.VERCEL_URL)
  );
}

function getEffectiveSqlitePath(configuredValue: string) {
  if (process.env.DATABASE_URL?.trim()) {
    return stripFileProtocol(configuredValue);
  }

  return isHostedRuntime() ? defaultHostedSqlitePath : defaultLocalSqliteRelativePath;
}

export function resolveSqliteDatabasePath() {
  const configuredValue = getConfiguredDatabaseUrl();
  const parsedUrl = tryParseUrl(configuredValue);

  if (parsedUrl && supportedRemoteProtocols.has(parsedUrl.protocol)) {
    throw new Error(
      `DATABASE_URL is set to "${configuredValue}", but this build currently supports only file-based SQLite paths.`,
    );
  }

  if (parsedUrl && !["file:"].includes(parsedUrl.protocol)) {
    throw new Error(
      `DATABASE_URL is set to "${configuredValue}", but this build currently supports only file-based SQLite paths.`,
    );
  }

  return resolve(
    /* turbopackIgnore: true */ process.cwd(),
    getEffectiveSqlitePath(configuredValue),
  );
}

export function getDatabaseRuntimeStatus() {
  const hosted = isHostedRuntime();
  const hostedTarget = getHostedDatabaseTargetStatus();

  if (hosted && hostedTarget.ready && hostedTarget.url) {
    return {
      kind: "libsql_hosted" as const,
      configuredValue: hostedTarget.url,
      resolvedPath: null,
      hostedReady: true,
      ephemeral: false,
      label: "Hosted LibSQL",
      message:
        "This hosted runtime uses durable LibSQL/Turso storage for persisted reads and writes.",
    };
  }

  try {
    const configuredValue = getConfiguredDatabaseUrl();
    const resolvedPath = resolveSqliteDatabasePath();
    const explicitDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

    return {
      kind: "sqlite_file" as const,
      configuredValue,
      resolvedPath,
      hostedReady: false,
      ephemeral: hosted && !explicitDatabaseUrl,
      label: hosted ? "Ephemeral SQLite Preview" : "Local SQLite",
      message:
        hosted && !explicitDatabaseUrl
          ? "This hosted preview falls back to /tmp SQLite storage so the app can boot, but data is ephemeral and resets between deployments or cold starts."
          : "This build stores state in a local SQLite file. That is fine for desktop development, but a Vercel deployment still needs a hosted database migration before it becomes durable.",
    };
  } catch (error) {
    return {
      kind: "unsupported_database_url" as const,
      configuredValue: getConfiguredDatabaseUrl(),
      resolvedPath: null,
      hostedReady: false,
      ephemeral: false,
      label: "Unsupported DATABASE_URL",
      message:
        error instanceof Error
          ? error.message
          : "DATABASE_URL is not compatible with the current SQLite-only runtime.",
    };
  }
}

export function getHostedDatabaseTargetStatus() {
  const url = process.env.HOSTED_DATABASE_URL?.trim() || "";
  const authToken = process.env.HOSTED_DATABASE_AUTH_TOKEN?.trim() || "";
  const parsedUrl = url ? tryParseUrl(url) : null;
  const supported = Boolean(parsedUrl && supportedRemoteProtocols.has(parsedUrl.protocol));

  return {
    configured: Boolean(url),
    supported,
    authTokenConfigured: Boolean(authToken),
    ready: Boolean(url) && supported && Boolean(authToken),
    url: url || null,
    message: !url
      ? "No hosted database target is configured yet."
      : !supported
        ? "HOSTED_DATABASE_URL must be a LibSQL-compatible URL."
        : !authToken
          ? "Add HOSTED_DATABASE_AUTH_TOKEN before migrating or syncing the hosted database."
          : "Hosted LibSQL target is configured for migration and data sync.",
  };
}

export function getRuntimeEnvironmentSummary() {
  const isVercel = isHostedRuntime();
  const appBaseUrl =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  const hasExplicitAppUrl = Boolean(
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim(),
  );
  const browserAutomationAvailable =
    !isVercel && process.platform === "win32" && Boolean(process.env.LOCALAPPDATA);

  return {
    isVercel,
    isHosted: isVercel,
    runtimeLabel: isVercel ? "Vercel" : process.platform === "win32" ? "Local Windows" : "Local",
    appBaseUrl,
    hasExplicitAppUrl,
    appBaseUrlHostedReady: !isVercel || hasExplicitAppUrl,
    appBaseUrlMessage:
      !isVercel || hasExplicitAppUrl
        ? `Using ${appBaseUrl} for OAuth callbacks and absolute links.`
        : "Set APP_URL to your deployed site URL before using hosted OAuth callbacks.",
    browserAutomationAvailable,
    browserAutomationMessage: browserAutomationAvailable
      ? "Browser-backed collection can use local Chrome or Edge profile data on this machine."
      : isVercel
        ? "Browser-backed collection is local-only and is intentionally unavailable on Vercel."
        : "Browser-backed collection needs a local Windows runtime with Chrome or Edge profile data.",
    database: getDatabaseRuntimeStatus(),
  };
}

export function getHostedPreviewMutationStatus() {
  const runtime = getRuntimeEnvironmentSummary();
  const readOnlyHostedPreview = runtime.isHosted && runtime.database.ephemeral;

  return {
    readOnlyHostedPreview,
    writesAllowed: !readOnlyHostedPreview,
    message: readOnlyHostedPreview
      ? "This hosted preview is running on ephemeral /tmp SQLite storage, so write actions are disabled until the live runtime switches to durable hosted persistence."
      : "Write actions are available for this runtime.",
  };
}

export function getHostedPreviewWriteRedirect(targetPath: string, actionLabel: string) {
  const runtime = getRuntimeEnvironmentSummary();
  const mutationStatus = getHostedPreviewMutationStatus();
  if (!mutationStatus.readOnlyHostedPreview) {
    return null;
  }

  const separator = targetPath.includes("?") ? "&" : "?";
  return `${targetPath}${separator}status=error&message=${encodeURIComponent(
    `This hosted preview is read-only while it uses ephemeral /tmp SQLite storage, so it cannot ${actionLabel} yet.`,
  )}`;
}
