"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  approveGeneratedDocument,
  linkDocumentToApplication,
} from "@/lib/applications/workflow-store";
import { getHostedPreviewWriteRedirect } from "@/lib/runtime/deployment";

function revalidateDocumentSurfaces(jobId: number) {
  revalidatePath("/documents");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/tailor/${jobId}`);
  revalidatePath("/applications");
}

export async function approveGeneratedDocumentAction(formData: FormData) {
  const documentId = Number(formData.get("documentId"));
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/tailor/${jobId}` : "/documents",
    "approve generated documents",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  if (!Number.isFinite(documentId) || !Number.isFinite(jobId)) {
    redirect("/documents?status=error&message=Unable to update the document approval state.");
  }

  const result = await approveGeneratedDocument({ documentId, jobId });
  if (!result.ok) {
    redirect(`/documents?status=error&message=${encodeURIComponent(result.message)}`);
  }

  revalidateDocumentSurfaces(jobId);

  redirect(
    `/tailor/${jobId}?status=success&message=${encodeURIComponent(
      `${result.documentType.replaceAll("_", " ")} v${result.version} is now approved for submission.`,
    )}`,
  );
}

export async function useDocumentForApplicationAction(formData: FormData) {
  const documentId = Number(formData.get("documentId"));
  const jobId = Number(formData.get("jobId"));
  const blockedRedirect = getHostedPreviewWriteRedirect(
    Number.isFinite(jobId) ? `/tailor/${jobId}` : "/applications",
    "link documents to application records",
  );
  if (blockedRedirect) {
    redirect(blockedRedirect as never);
  }

  if (!Number.isFinite(documentId) || !Number.isFinite(jobId)) {
    redirect("/applications?status=error&message=Unable to link the selected document.");
  }

  const result = await linkDocumentToApplication({ documentId, jobId });
  if (!result.ok) {
    redirect(`/tailor/${jobId}?status=error&message=${encodeURIComponent(result.message)}`);
  }

  revalidateDocumentSurfaces(jobId);

  redirect(
    `/jobs/${jobId}?status=success&message=${encodeURIComponent(
      `${result.documentType.replaceAll("_", " ")} v${result.version} is now linked to the application record.`,
    )}`,
  );
}
