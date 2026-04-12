import { eq } from "drizzle-orm";

import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { db } from "@/lib/db/client";
import { platformConnections } from "@/lib/db/schema/integrations";
import { getPlatformConnection } from "@/lib/connections/queries";
import { inspectBrowserAutomation } from "@/lib/playwright/profile";
import { getRuntimeEnvironmentSummary } from "@/lib/runtime/deployment";

const browserSearchPlatforms = ["google_jobs", "linkedin", "indeed"] as const;
const browserBackedPlatforms = [
  "google_jobs",
  "linkedin",
  "indeed",
  "upwork",
  "fiverr",
] as const;

export async function updatePlatformConnection(input: {
  platform: string;
  browserType: string;
  browserProfileName: string;
  connectionMode: string;
  debugPortValue: string;
  notes: string;
  isEnabled: boolean;
}) {
  await ensureDefaultRecords();

  if (!input.platform) {
    return {
      ok: false as const,
      message: "Platform connection update failed.",
    };
  }

  const runtime = getRuntimeEnvironmentSummary();
  const browserBackedPlatform = browserBackedPlatforms.includes(
    input.platform as (typeof browserBackedPlatforms)[number],
  );
  const effectiveIsEnabled =
    input.isEnabled && (!browserBackedPlatform || runtime.browserAutomationAvailable);
  const debugPort =
    input.debugPortValue.length > 0 && Number.isFinite(Number(input.debugPortValue))
      ? Number(input.debugPortValue)
      : null;

  await db
    .update(platformConnections)
    .set({
      browserType: input.browserType || null,
      browserProfileName: input.browserProfileName || null,
      connectionMode: input.connectionMode || "launch",
      debugPort,
      notes: input.notes || null,
      isEnabled: effectiveIsEnabled,
    })
    .where(eq(platformConnections.platform, input.platform))
    .run();

  return {
    ok: true as const,
    message:
      browserBackedPlatform && input.isEnabled && !runtime.browserAutomationAvailable
        ? `${input.platform} was saved, but it stayed disabled because browser-backed collection is local-only. ${runtime.browserAutomationMessage}`
        : "Platform connection updated.",
  };
}

export async function verifyPlatformConnection(platform: string) {
  await ensureDefaultRecords();

  if (!platform) {
    return {
      ok: false as const,
      message: "Platform connection verification failed.",
    };
  }

  const runtime = getRuntimeEnvironmentSummary();
  if (!runtime.browserAutomationAvailable) {
    return {
      ok: false as const,
      message: `Browser profile verification is unavailable here. ${runtime.browserAutomationMessage}`,
    };
  }

  const connection = await getPlatformConnection(platform);
  if (!connection) {
    return {
      ok: false as const,
      message: "Platform connection was not found.",
    };
  }

  const inspection = inspectBrowserAutomation({
    isEnabled: true,
    browserType: connection.browserType,
    browserProfileName: connection.browserProfileName,
    bypassEnabledCheck: true,
  });

  if (inspection.status === "ready") {
    await db
      .update(platformConnections)
      .set({
        lastVerifiedAt: new Date().toISOString(),
      })
      .where(eq(platformConnections.platform, platform))
      .run();

    return {
      ok: true as const,
      message: `${platform} verified. ${inspection.message}`,
    };
  }

  return {
    ok: false as const,
    message: `${platform} is not ready yet. ${inspection.message}`,
  };
}

export async function enableBrowserSearchBundle() {
  await ensureDefaultRecords();
  const runtime = getRuntimeEnvironmentSummary();

  if (!runtime.browserAutomationAvailable) {
    return {
      ok: false as const,
      message: `The browser search bundle can only be enabled on a local Windows runtime. ${runtime.browserAutomationMessage}`,
    };
  }

  const inspection = inspectBrowserAutomation({
    isEnabled: true,
    browserType: "chrome",
    browserProfileName: "Job Search OS",
    bypassEnabledCheck: true,
  });

  const lastVerifiedAt =
    inspection.status === "ready" ? new Date().toISOString() : null;

  for (const platform of browserSearchPlatforms) {
    await db
      .update(platformConnections)
      .set({
        browserType: "chrome",
        browserProfileName: "Job Search OS",
        connectionMode: "attach",
        debugPort: 9222,
        isEnabled: true,
        lastVerifiedAt,
        notes:
          platform === "google_jobs"
            ? "Browser-backed Google Jobs collection is enabled against the Job Search OS profile."
            : platform === "linkedin"
              ? "Browser-backed LinkedIn collection is enabled against the Job Search OS profile."
              : "Browser-backed Indeed collection is enabled against the Job Search OS profile.",
      })
      .where(eq(platformConnections.platform, platform))
      .run();
  }

  return {
    ok: true as const,
    message:
      inspection.status === "ready"
        ? "Google Jobs, LinkedIn, and Indeed are enabled in attach mode for the Job Search OS browser profile."
        : `The browser search bundle was enabled, but the profile still needs attention. ${inspection.message}`,
  };
}
