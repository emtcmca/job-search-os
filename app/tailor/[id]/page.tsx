import { notFound } from "next/navigation";

import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { createApplicationFromJobAction } from "@/app/applications/actions";
import { generateTailoringDraftAction } from "@/app/tailor/actions";
import { estimateTier1Cost } from "@/lib/ai/config";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getAiBudgetSettings, getAiUsageSummary, getJobDetail, listCandidateProfiles } from "@/lib/jobs/queries";

type TailorPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function TailorPage({
  params,
  searchParams,
}: TailorPageProps) {
  await ensureDefaultRecords();
  const { id } = await params;
  const jobId = Number(id);
  const detail = Number.isFinite(jobId) ? getJobDetail(jobId) : null;
  const profiles = listCandidateProfiles();
  const budget = getAiBudgetSettings();
  const usage = getAiUsageSummary();
  const search = searchParams ? await searchParams : undefined;

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
          body="Every generated resume, cover letter, or proposal will be versioned in the database and stored on disk in a structured folder."
        >
          <form action={generateTailoringDraftAction} className="space-y-3">
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
              className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white"
            >
              Generate tailoring drafts
            </button>
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
          body="New drafts are stored as markdown files on disk and as versioned records in the app."
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <form action={createApplicationFromJobAction}>
              <input type="hidden" name="jobId" value={detail.job.id} />
              <button
                type="submit"
                className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)]"
              >
                {detail.application ? "Refresh application record" : "Create application record"}
              </button>
            </form>
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
                  <div className="font-medium text-[var(--foreground)]">
                    {document.documentType.replaceAll("_", " ")} v{document.version}
                  </div>
                  <div className="mt-1 text-[var(--muted)]">{document.filePath}</div>
                  <div className="mt-2 line-clamp-4 whitespace-pre-wrap text-[var(--muted)]">
                    {document.contentText}
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
