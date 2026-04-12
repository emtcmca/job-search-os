"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getHostedPreviewWriteRedirect } from "@/lib/runtime/deployment";
import { runSavedSearch } from "@/lib/searches/runner";
import {
  createSavedSearch,
  seedBrowserDemoSearch,
  seedDemoSavedSearches,
  toggleSavedSearch,
} from "@/lib/searches/workflow-store";

export async function createSavedSearchAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/searches",
    "create saved searches",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const name = String(formData.get("name") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "manual");
  const trackedUrlsText = String(formData.get("trackedUrls") ?? "");
  const strictKeywordMatch = formData.get("strictKeywordMatch") === "on";
  const sources = formData
    .getAll("sources")
    .map((value) => String(value))
    .filter(Boolean);

  const result = await createSavedSearch({
    name,
    keywords,
    sources,
    cadence,
    trackedUrlsText,
    strictKeywordMatch,
  });

  revalidatePath("/searches");
  const status = result.ok ? "success" : "error";
  redirect(`/searches?status=${status}&message=${encodeURIComponent(result.message)}`);
}

export async function seedDemoSavedSearchesAction() {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/searches",
    "seed demo ATS searches",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await seedDemoSavedSearches();

  revalidatePath("/searches");
  const status = result.ok ? "success" : "error";
  redirect(`/searches?status=${status}&message=${encodeURIComponent(result.message)}`);
}

export async function seedBrowserDemoSearchAction() {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/searches",
    "seed browser demo searches",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await seedBrowserDemoSearch();

  revalidatePath("/searches");
  const status = result.ok ? "success" : "error";
  redirect(`/searches?status=${status}&message=${encodeURIComponent(result.message)}`);
}

export async function toggleSavedSearchAction(formData: FormData) {
  const searchId = Number(formData.get("searchId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/searches",
    "update saved searches",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }
  const nextState = formData.get("nextState") === "true";

  if (!Number.isFinite(searchId)) {
    redirect("/searches?status=error&message=Saved search could not be updated.");
  }

  const result = await toggleSavedSearch({ searchId, nextState });

  revalidatePath("/searches");
  const status = result.ok ? "success" : "error";
  redirect(`/searches?status=${status}&message=${encodeURIComponent(result.message)}`);
}

export async function runSavedSearchAction(formData: FormData) {
  const searchId = Number(formData.get("searchId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/searches",
    "run saved searches",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

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
