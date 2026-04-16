"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getHostedPreviewWriteRedirect } from "@/lib/runtime/deployment";
import {
  buildServiceListing,
  createFreelanceLead,
  createFreelanceProfile,
  importClaudeStorageDump,
  runNicheDiscovery,
  runProposalGeneration,
  updateFreelanceLeadStage,
  updateFreelanceNiche,
  updateFreelanceProfile,
  updateServiceListing,
} from "@/lib/freelance/workflow-store";

function redirectWithResult(path: string, result: { ok: boolean; message: string }) {
  const status = result.ok ? "success" : "error";
  redirect(
    `${path}?status=${status}&message=${encodeURIComponent(result.message)}` as never,
  );
}

export async function createFreelanceLeadAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/freelance",
    "create freelance leads",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await createFreelanceLead({
    title: String(formData.get("title") ?? ""),
    platform: String(formData.get("platform") ?? "Upwork"),
    url: String(formData.get("url") ?? ""),
    rawDescription: String(formData.get("rawDescription") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  revalidatePath("/freelance");
  if (result.ok) {
    redirect(
      `/freelance/${result.jobId}?status=success&message=${encodeURIComponent(
        result.message,
      )}`,
    );
  }

  redirectWithResult("/freelance", result);
}

export async function updateFreelanceLeadStageAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/freelance/${jobId}` : "/freelance",
    "update freelance leads",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await updateFreelanceLeadStage({
    jobId,
    stage: String(formData.get("stage") ?? ""),
  });

  revalidatePath("/freelance");
  revalidatePath(`/freelance/${jobId}`);
  redirectWithResult(Number.isFinite(jobId) ? `/freelance/${jobId}` : "/freelance", result);
}

export async function updateFreelanceProfileAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/freelance",
    "update freelance positioning memory",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await updateFreelanceProfile({
    profileId: Number(formData.get("profileId")),
    name: String(formData.get("name") ?? ""),
    servicesText: String(formData.get("servicesText") ?? ""),
    pricingJson: String(formData.get("pricingJson") ?? "{}"),
    voiceJson: String(formData.get("voiceJson") ?? "{}"),
    proofPointsText: String(formData.get("proofPointsText") ?? ""),
    bannedClaimsText: String(formData.get("bannedClaimsText") ?? ""),
    platformPreferencesJson: String(formData.get("platformPreferencesJson") ?? "{}"),
    notes: String(formData.get("notes") ?? ""),
  });

  revalidatePath("/freelance");
  redirectWithResult("/freelance", result);
}

export async function createFreelanceProfileAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/freelance",
    "create freelance positioning profiles",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await createFreelanceProfile({
    name: String(formData.get("name") ?? ""),
  });

  revalidatePath("/freelance");
  redirectWithResult("/freelance", result);
}

export async function importClaudeStorageAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/freelance",
    "import Claude storage",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const profileId = Number(formData.get("profileId"));
  const result = await importClaudeStorageDump({
    rawDump: String(formData.get("rawDump") ?? ""),
    profileId: Number.isFinite(profileId) ? profileId : null,
  });

  revalidatePath("/freelance");
  redirectWithResult("/freelance", result);
}

export async function discoverFreelanceNichesAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/freelance",
    "discover freelance niches",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const profileId = Number(formData.get("profileId"));
  const result = await runNicheDiscovery(Number.isFinite(profileId) ? profileId : null);

  revalidatePath("/freelance");
  redirectWithResult("/freelance", result);
}

export async function updateFreelanceNicheAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect("/freelance", "update niches");
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await updateFreelanceNiche({
    nicheId: Number(formData.get("nicheId")),
    status: String(formData.get("status") ?? "candidate"),
    notes: String(formData.get("notes") ?? ""),
  });

  revalidatePath("/freelance");
  redirectWithResult("/freelance", result);
}

export async function buildServiceListingAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/freelance",
    "generate service listings",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const profileId = Number(formData.get("profileId"));
  const result = await buildServiceListing({
    nicheId: Number(formData.get("nicheId")),
    platform: String(formData.get("platform") ?? "Upwork"),
    profileId: Number.isFinite(profileId) ? profileId : null,
  });

  revalidatePath("/freelance");
  redirectWithResult("/freelance", result);
}

export async function updateServiceListingAction(formData: FormData) {
  const blockedRedirect = getHostedPreviewWriteRedirect(
    "/freelance",
    "update service listings",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const result = await updateServiceListing({
    listingId: Number(formData.get("listingId")),
    status: String(formData.get("status") ?? "active"),
    notes: String(formData.get("notes") ?? ""),
    performanceJson: String(formData.get("performanceJson") ?? "{}"),
  });

  revalidatePath("/freelance");
  redirectWithResult("/freelance", result);
}

export async function generateFreelanceProposalAction(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/freelance/${jobId}` : "/freelance",
    "generate freelance proposals",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  const profileId = Number(formData.get("profileId"));
  const result = await runProposalGeneration({
    jobId,
    platform: String(formData.get("platform") ?? "Upwork"),
    tone: String(formData.get("tone") ?? "balanced"),
    profileId: Number.isFinite(profileId) ? profileId : null,
  });

  revalidatePath("/freelance");
  revalidatePath(`/freelance/${jobId}`);
  redirectWithResult(Number.isFinite(jobId) ? `/freelance/${jobId}` : "/freelance", result);
}
