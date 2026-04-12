"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  enableBrowserSearchBundle,
  updatePlatformConnection,
  verifyPlatformConnection,
} from "@/lib/connections/workflow-store";
import {
  getHostedPreviewWriteRedirect,
  getRuntimeEnvironmentSummary,
} from "@/lib/runtime/deployment";

const browserBackedPlatforms = [
  "google_jobs",
  "linkedin",
  "indeed",
  "upwork",
  "fiverr",
] as const;

export async function updatePlatformConnectionAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/connections",
    "update platform connections",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const platform = String(formData.get("platform") ?? "").trim();
  const browserType = String(formData.get("browserType") ?? "").trim();
  const browserProfileName = String(formData.get("browserProfileName") ?? "").trim();
  const connectionMode = String(formData.get("connectionMode") ?? "launch").trim();
  const debugPortValue = String(formData.get("debugPort") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const isEnabled = formData.get("isEnabled") === "on";
  const runtime = getRuntimeEnvironmentSummary();
  const browserBackedPlatform = browserBackedPlatforms.includes(
    platform as (typeof browserBackedPlatforms)[number],
  );

  if (!platform) {
    redirect("/connections?status=error&message=Platform connection update failed.");
  }

  const result = await updatePlatformConnection({
    platform,
    browserType,
    browserProfileName,
    connectionMode,
    debugPortValue,
    notes,
    isEnabled,
  });

  revalidatePath("/connections");
  revalidatePath("/searches");
  const status =
    browserBackedPlatform && isEnabled && !runtime.browserAutomationAvailable
      ? "error"
      : result.ok
        ? "success"
        : "error";
  redirect(`/connections?status=${status}&message=${encodeURIComponent(result.message)}`);
}

export async function verifyPlatformConnectionAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/connections",
    "verify platform connections",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const platform = String(formData.get("platform") ?? "").trim();

  if (!platform) {
    redirect("/connections?status=error&message=Platform connection verification failed.");
  }

  const runtime = getRuntimeEnvironmentSummary();
  if (!runtime.browserAutomationAvailable) {
    redirect(
      `/connections?status=error&message=${encodeURIComponent(
        `Browser profile verification is unavailable here. ${runtime.browserAutomationMessage}`,
      )}`,
    );
  }

  const result = await verifyPlatformConnection(platform);

  revalidatePath("/connections");
  revalidatePath("/searches");
  redirect(`/connections?status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(result.message)}`);
}

export async function enableBrowserSearchBundleAction() {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/connections",
    "enable the browser search bundle",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const runtime = getRuntimeEnvironmentSummary();

  if (!runtime.browserAutomationAvailable) {
    redirect(
      `/connections?status=error&message=${encodeURIComponent(
        `The browser search bundle can only be enabled on a local Windows runtime. ${runtime.browserAutomationMessage}`,
      )}`,
    );
  }

  const result = await enableBrowserSearchBundle();

  revalidatePath("/connections");
  revalidatePath("/searches");
  redirect(`/connections?status=${result.ok ? "success" : "error"}&message=${encodeURIComponent(result.message)}`);
}
