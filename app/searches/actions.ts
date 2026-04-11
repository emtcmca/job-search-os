"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { db } from "@/lib/db/client";
import { savedSearches } from "@/lib/db/schema/saved-searches";
import { buildSavedSearchPayload, runSavedSearch } from "@/lib/searches/runner";

export async function createSavedSearchAction(formData: FormData) {
  await ensureDefaultRecords();

  const name = String(formData.get("name") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "manual");
  const trackedUrlsText = String(formData.get("trackedUrls") ?? "");
  const strictKeywordMatch = formData.get("strictKeywordMatch") === "on";
  const sources = formData
    .getAll("sources")
    .map((value) => String(value))
    .filter(Boolean);

  if (!name || !keywords) {
    redirect(
      "/searches?status=error&message=Name and keywords are required to create a saved search.",
    );
  }

  const payload = buildSavedSearchPayload({
    name,
    keywords,
    sources,
    cadence,
    trackedUrlsText,
    strictKeywordMatch,
  });

  db.insert(savedSearches)
    .values({
      ...payload,
      type: "full_time",
      isActive: true,
    })
    .run();

  revalidatePath("/searches");
  redirect("/searches?status=success&message=Saved search created.");
}

export async function toggleSavedSearchAction(formData: FormData) {
  const searchId = Number(formData.get("searchId"));
  const nextState = formData.get("nextState") === "true";

  if (!Number.isFinite(searchId)) {
    redirect("/searches?status=error&message=Saved search could not be updated.");
  }

  db.update(savedSearches)
    .set({
      isActive: nextState,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(savedSearches.id, searchId))
    .run();

  revalidatePath("/searches");
  redirect(`/searches?status=success&message=${encodeURIComponent("Saved search updated.")}`);
}

export async function runSavedSearchAction(formData: FormData) {
  const searchId = Number(formData.get("searchId"));

  if (!Number.isFinite(searchId)) {
    redirect("/searches?status=error&message=Saved search run failed.");
  }

  const result = await runSavedSearch(searchId);
  revalidatePath("/searches");
  revalidatePath("/jobs");
  revalidatePath("/");

  const status = result.ok ? "success" : "error";
  const notes = "notes" in result ? result.notes : undefined;
  const details =
    notes && notes.length > 0
      ? `&details=${encodeURIComponent(notes.slice(0, 4).join("\n"))}`
      : "";
  redirect(`/searches?status=${status}&message=${encodeURIComponent(result.message)}${details}`);
}
