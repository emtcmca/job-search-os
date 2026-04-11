"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { platformConnections } from "@/lib/db/schema/integrations";
import { inspectBrowserAutomation } from "@/lib/playwright/profile";

export async function updatePlatformConnectionAction(formData: FormData) {
  const platform = String(formData.get("platform") ?? "").trim();
  const browserType = String(formData.get("browserType") ?? "").trim();
  const browserProfileName = String(formData.get("browserProfileName") ?? "").trim();
  const connectionMode = String(formData.get("connectionMode") ?? "launch").trim();
  const debugPortValue = String(formData.get("debugPort") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const isEnabled = formData.get("isEnabled") === "on";
  const debugPort =
    debugPortValue.length > 0 && Number.isFinite(Number(debugPortValue))
      ? Number(debugPortValue)
      : null;

  if (!platform) {
    redirect("/connections?status=error&message=Platform connection update failed.");
  }

  db.update(platformConnections)
    .set({
      browserType: browserType || null,
      browserProfileName: browserProfileName || null,
      connectionMode: connectionMode || "launch",
      debugPort,
      notes: notes || null,
      isEnabled,
    })
    .where(eq(platformConnections.platform, platform))
    .run();

  revalidatePath("/connections");
  revalidatePath("/searches");
  redirect("/connections?status=success&message=Platform connection updated.");
}

export async function verifyPlatformConnectionAction(formData: FormData) {
  const platform = String(formData.get("platform") ?? "").trim();

  if (!platform) {
    redirect("/connections?status=error&message=Platform connection verification failed.");
  }

  const connection = db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.platform, platform))
    .get();

  if (!connection) {
    redirect("/connections?status=error&message=Platform connection was not found.");
  }

  const inspection = inspectBrowserAutomation({
    isEnabled: true,
    browserType: connection.browserType,
    browserProfileName: connection.browserProfileName,
    bypassEnabledCheck: true,
  });

  if (inspection.status === "ready") {
    db.update(platformConnections)
      .set({
        lastVerifiedAt: new Date().toISOString(),
      })
      .where(eq(platformConnections.platform, platform))
      .run();

    revalidatePath("/connections");
    revalidatePath("/searches");
    redirect(
      `/connections?status=success&message=${encodeURIComponent(
        `${platform} verified. ${inspection.message}`,
      )}`,
    );
  }

  revalidatePath("/connections");
  redirect(
    `/connections?status=error&message=${encodeURIComponent(
      `${platform} is not ready yet. ${inspection.message}`,
    )}`,
  );
}
