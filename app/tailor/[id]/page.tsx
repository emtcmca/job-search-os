import { notFound } from "next/navigation";

import {
  approveGeneratedDocumentAction,
  useDocumentForApplicationAction,
} from "@/app/documents/actions";
import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { createApplicationFromJobAction } from "@/app/applications/actions";
import { generateTailoringDraftAction } from "@/app/tailor/actions";
import { estimateTier1Cost } from "@/lib/ai/config";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getAiBudgetSettings, getAiUsageSummary, getJobDetail, listCandidateProfiles } from "@/lib/jobs/queries";
import { getHostedPreviewMutationStatus } from "@/lib/runtime/deployment";

type TailorPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

function formatDocumentType(value: string) {
  return value.replaceAll("_", " ");
}

export default async function TailorPage({
  params,
  searchParams,
}: TailorPageProps) {
  await ensureDefaultRecords();
  const { id } = await params;
  const jobId = Number(id);
  const search = searchParams ? await searchParams : undefined;
  const mutationStatus = getHostedPreviewMutationStatus();
  const [detail, profiles, budget, usage] = await Promise.all([
    Number.isFinite(jobId) ? getJobDetail(jobId) : Promise.resolve(null),
    listCandidateProfiles(),
    getAiBudgetSettings(),
    getAiUsageSummary(),
  ]);

  if (!detail) {
    notFound();
  }

  const suggestedProfile =
    profiles.find((profile) => profile.profileType === detail.score?.recommendedResumeType) ??
    profiles.find((profile) => profile.isCanonical) ??
    profiles[0];
  const estimated = estimateTier1Cost(detail.snapshot?.rawText ?? "", 1400);

  return (
    <PageFrame
      eyebrow="Tailoring Review"
      title={`Tailor for ${detail.job.title}`}
      description="This workspace will recommend the best baseline resume or profile, generate tailored drafts under strict guardrails, and keep provenance visible."
    >
      {search?.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow)] ${
            search.status === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-950"
          }`}
        >
          {search.message}
        </div>
      ) : null}

      {mutationStatus.readOnlyHostedPreview ? (
        <ReadOnlyNotice message={mutationStatus.message} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard
          title="Guardrails"
          body="Dates and titles stay exact. Experience cannot be invented. New factual additions require your explicit confirmation before they are included."
        >
          <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
            <li>The app drafts from your stored profile facts only.</li>
            <li>Recommended profile lane currently: {detail.score?.recommendedResumeType ?? "not set yet"}.</li>
            <li>Estimated AI cost for this tailoring run: ${estimated.estimatedCost.toFixed(4)}.</li>
            <li>
              Current monthly AI spend: ${usage.spent.toFixed(4)} of $
              {(budget?.monthlyBudget ?? 25).toFixed(2)}.
            </li>
          </ul>
        </InfoCard>
        <InfoCard
          title="Artifacts"
          body="Every generated resume, cover letter, or proposal will be versioned in the database and stored on disk in a structured folder. If an application record already exists, the latest drafts will now auto-link to it."
        >
          <form action={generateTailoringDraftAction}>
            <fieldset
              disabled={!mutationStatus.writesAllowed}
              className={`space-y-3 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
            >
              <input type="hidden" name="jobId" value={detail.job.id} />
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Profile lane
                <select
                  name="profileId"
                  defaultValue={suggestedProfile?.id}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.profileType})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Generate tailoring drafts
              </button>
            </fieldset>
          </form>
        </InfoCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <InfoCard
          title="Job context"
          body="The draft packet uses the latest snapshot and score recommendation for this opportunity."
        >
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <div>
              <span className="font-medium text-[var(--foreground)]">Company:</span>{" "}
              {detail.company?.name ?? "Pending parse"}
            </div>
            <div>
              <span className="font-medium text-[var(--foreground)]">Recommendation:</span>{" "}
              {(detail.score?.recommendation ?? "review").replaceAll("_", " ")}
            </div>
            <div>
              <span className="font-medium text-[var(--foreground)]">Summary:</span>{" "}
              {detail.score?.summary ?? "No score summary available yet."}
            </div>
          </div>
        </InfoCard>

        <InfoCard
          title="Generated drafts"
          body="You can now keep the latest generated draft separate from the approved submission version. Approved versions become the default packet for application refreshes, while manual linking lets you override that on purpose."
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <form action={createApplicationFromJobAction}>
              <input type="hidden" name="jobId" value={detail.job.id} />
              <button
                type="submit"
                disabled={!mutationStatus.writesAllowed}
                className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {detail.application ? "Refresh application record" : "Create application record"}
              </button>
            </form>
          </div>
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm text-[var(--muted)]">
            <div>
              Preferred submission packet:{" "}
              {detail.draftPacket.hasApprovedPacket
                ? "using approved versions"
                : "using latest generated versions"}
            </div>
            <div className="mt-2">
              Latest packet complete: {detail.draftPacket.hasCompleteLatestPacket ? "yes" : "no"} | Preferred packet complete: {detail.draftPacket.hasCompleteDraftPacket ? "yes" : "no"}
            </div>
            {detail.application ? (
              detail.draftPacket.needsResumeRefresh || detail.draftPacket.needsCoverLetterRefresh ? (
                <div className="mt-2">The application record exists, but it is not linked to the preferred submission packet yet.</div>
              ) : detail.draftPacket.hasCompleteDraftPacket ? (
                <div className="mt-2">The application record is aligned with the preferred submission packet.</div>
              ) : (
                <div className="mt-2">The application record exists, but the preferred submission packet is still incomplete.</div>
              )
            ) : (
              <div className="mt-2">No application record exists yet for this job.</div>
            )}
          </div>
          <div className="space-y-3">
            {detail.documents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No generated drafts yet.
              </div>
            ) : (
              detail.documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-medium text-[var(--foreground)]">
                      {formatDocumentType(document.documentType)} v{document.version}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em]">
                      {document.approvalState === "approved" ? (
                        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent)]">
                          Approved
                        </span>
                      ) : null}
                      {detail.application?.resumeDocId === document.id ||
                      detail.application?.coverLetterDocId === document.id ? (
                        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 font-medium text-[var(--foreground)]">
                          Linked to app
                        </span>
                      ) : null}
                      {detail.draftPacket.preferredResumeStrategy?.id === document.id ||
                      detail.draftPacket.preferredCoverLetter?.id === document.id ? (
                        <span className="rounded-full border border-[var(--accent)] px-2.5 py-1 font-medium text-[var(--accent)]">
                          Preferred
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-[var(--muted)]">{document.filePath}</div>
                  <div className="mt-2 line-clamp-4 whitespace-pre-wrap text-[var(--muted)]">
                    {document.contentText}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {document.approvalState !== "approved" ? (
                      <form action={approveGeneratedDocumentAction}>
                        <input type="hidden" name="jobId" value={detail.job.id} />
                        <input type="hidden" name="documentId" value={document.id} />
                        <button
                          type="submit"
                          disabled={!mutationStatus.writesAllowed}
                          className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Approve for submission
                        </button>
                      </form>
                    ) : null}
                    {detail.application ? (
                      <form action={useDocumentForApplicationAction}>
                        <input type="hidden" name="jobId" value={detail.job.id} />
                        <input type="hidden" name="documentId" value={document.id} />
                        <button
                          type="submit"
                          disabled={!mutationStatus.writesAllowed}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Use in application
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </InfoCard>
      </div>
    </PageFrame>
  );
}
