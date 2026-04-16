import Link from "next/link";
import { notFound } from "next/navigation";

import {
  generateFreelanceProposalAction,
  updateFreelanceLeadStageAction,
} from "@/app/freelance/actions";
import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { safeJsonParse } from "@/lib/freelance/json";
import { getFreelanceLead, listFreelanceProfiles } from "@/lib/freelance/queries";
import { freelancePlatforms, normalizeFreelancePlatform } from "@/lib/freelance/platforms";
import { getHostedPreviewMutationStatus } from "@/lib/runtime/deployment";

type FreelanceDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function FreelanceDetailPage({
  params,
  searchParams,
}: FreelanceDetailPageProps) {
  await ensureDefaultRecords();
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) {
    notFound();
  }

  const [detail, profiles, query] = await Promise.all([
    getFreelanceLead(jobId),
    listFreelanceProfiles(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  if (!detail) {
    notFound();
  }

  const mutationStatus = getHostedPreviewMutationStatus();
  const platform = normalizeFreelancePlatform(detail.lead.source);
  const latestFit = detail.drafts[0]
    ? safeJsonParse<{
        score?: number;
        verdict?: string;
        strengths?: string[];
        gaps?: string[];
        angle?: string;
        pursue?: boolean;
      }>(detail.drafts[0].fitJson, {})
    : null;

  return (
    <PageFrame
      eyebrow="Proposal Detail"
      title={detail.lead.title}
      description="Review the captured gig, run platform-specific fit analysis, and save proposal drafts against the freelance lead."
      metrics={[
        {
          label: "Stage",
          value: detail.lead.currentStage,
          hint: "Separate from the full-time application workflow.",
        },
        {
          label: "Drafts",
          value: String(detail.drafts.length),
          hint: "Generated proposal versions saved for this lead.",
        },
        {
          label: "Latest Fit",
          value: latestFit?.score !== undefined ? `${latestFit.score}/100` : "Not run",
          hint: latestFit?.verdict ?? "Generate a proposal to score this lead.",
        },
      ]}
    >
      {query?.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow)] ${
            query.status === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-950"
          }`}
        >
          {query.message}
        </div>
      ) : null}

      {mutationStatus.readOnlyHostedPreview ? (
        <ReadOnlyNotice message={mutationStatus.message} />
      ) : null}

      <div>
        <Link href="/freelance" className="text-sm font-medium text-[var(--accent)]">
          Back to freelance workspace
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <InfoCard title="Captured lead" body="The latest saved snapshot is used for proposal generation.">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
              <span>Source: {detail.lead.source}</span>
              <span>URL: {detail.lead.sourceUrl}</span>
              <span>Discovered: {new Date(detail.lead.discoveredAt).toLocaleString()}</span>
            </div>
            <form action={updateFreelanceLeadStageAction} className="flex flex-wrap gap-3">
              <input type="hidden" name="jobId" value={detail.lead.id} />
              <select
                name="stage"
                defaultValue={detail.lead.currentStage}
                className="rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              >
                {["review", "tailoring", "ready", "submitted", "interview", "won", "closed"].map(
                  (stage) => (
                    <option key={stage}>{stage}</option>
                  ),
                )}
              </select>
              <button
                type="submit"
                disabled={!mutationStatus.writesAllowed}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                Update stage
              </button>
            </form>
            <div className="max-h-[520px] overflow-auto rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm leading-7 text-[var(--muted)]">
              <pre className="whitespace-pre-wrap font-inherit">
                {detail.snapshot?.rawText || "No description snapshot was captured."}
              </pre>
            </div>
          </div>
        </InfoCard>

        <InfoCard
          title="Generate proposal"
          body="The prompt uses the editable freelance positioning memory plus platform-specific heuristics for fit scoring and proposal drafting."
        >
          <form action={generateFreelanceProposalAction}>
            <fieldset
              disabled={!mutationStatus.writesAllowed}
              className={`space-y-4 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
            >
              <input type="hidden" name="jobId" value={detail.lead.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm sm:col-span-1">
                  <span className="font-medium">Platform</span>
                  <select
                    name="platform"
                    defaultValue={platform}
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                  >
                    {freelancePlatforms.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-1">
                  <span className="font-medium">Tone</span>
                  <select
                    name="tone"
                    defaultValue="balanced"
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                  >
                    <option value="concise">Concise</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </label>
                <label className="block text-sm sm:col-span-1">
                  <span className="font-medium">Profile</span>
                  <select
                    name="profileId"
                    defaultValue={profiles.find((profile) => profile.isDefault)?.id}
                    className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Score and draft proposal
              </button>
            </fieldset>
          </form>

          {latestFit ? (
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">{latestFit.verdict ?? "Fit analysis"}</div>
                <div className="text-2xl font-semibold text-[var(--accent)]">
                  {latestFit.score ?? "n/a"}/100
                </div>
              </div>
              {latestFit.angle ? (
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {latestFit.angle}
                </div>
              ) : null}
              {latestFit.strengths?.length ? (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Strengths
                  </div>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--muted)]">
                    {latestFit.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {latestFit.gaps?.length ? (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Gaps
                  </div>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--muted)]">
                    {latestFit.gaps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </InfoCard>
      </div>

      <InfoCard title="Proposal drafts" body="Newest drafts appear first and remain attached to this lead.">
        <div className="space-y-4">
          {detail.drafts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
              No proposal drafts yet.
            </div>
          ) : (
            detail.drafts.map((draft) => (
              <div key={draft.id} className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-lg font-semibold">
                      {draft.platform} proposal · {draft.tone}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {new Date(draft.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]/70 p-4 text-sm leading-7">
                  {draft.contentText}
                </div>
              </div>
            ))
          )}
        </div>
      </InfoCard>
    </PageFrame>
  );
}
