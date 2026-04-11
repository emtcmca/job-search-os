"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { generateTailoringDraft } from "@/lib/tailoring/generate-tailoring";

export async function generateTailoringDraftAction(formData: FormData) {
  await ensureDefaultRecords();

  const jobId = Number(formData.get("jobId"));
  const profileIdRaw = String(formData.get("profileId") ?? "").trim();
  const profileId = profileIdRaw ? Number(profileIdRaw) : undefined;

  if (!Number.isFinite(jobId)) {
    redirect("/jobs?status=error&message=Unable to start tailoring.");
  }

  const result = await generateTailoringDraft(jobId, profileId);

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/tailor/${jobId}`);
  revalidatePath("/documents");
  revalidatePath("/");

  const status = result.ok ? "success" : "error";
  redirect(
    `/tailor/${jobId}?status=${status}&message=${encodeURIComponent(result.message)}`,
  );
}
