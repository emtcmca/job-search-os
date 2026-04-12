import Link from "next/link";

import { importJobAction, runTier1AnalysisAction } from "@/app/jobs/actions";
import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getAiBudgetSettings, getJobQueueSnapshot, type JobListItem } from "@/lib/jobs/queries";
import { getHostedPreviewMutationStatus } from "@/lib/runtime/deployment";

type JobsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

type QueueKind = "needsTier1" | "shortlist" | "deepReview" | "followUp";

type JobQueueListProps = {
  title: string;
  jobs: JobListItem[];
  kind: QueueKind;
  emptyMessage: string;
};

function formatRecommendation(value?: string | null) {
  return (value ?? "review").replaceAll("_", " ");
}

function formatTier(value?: string | null) {
  return (value ?? "tier_0").replaceAll("_", " ");
}

function formatAlternateSources(sources: string[]) {
  return sources.map((source) => source.replaceAll("_", " ")).join(", ");
}

function queueBody(job: JobListItem, kind: QueueKind) {
  if (kind === "deepReview") {
    return (
      job.score?.deepReviewReason ??
      job.score?.summary ??
      "This job would benefit from a closer, higher-context fit review."
    );
  }

  if (kind === "followUp") {
    return job.nextReminderAt
      ? `Next reminder ${new Date(job.nextReminderAt).toLocaleString()}`
      : `Application status: ${job.application?.status ?? "not created"}`;
  }

  return job.score?.summary ?? "No score summary has been generated yet.";
}

function queueBadge(job: JobListItem, kind: QueueKind) {
  if (kind === "shortlist") {
    return job.currentStage;
  }

  if (kind === "followUp") {
    return `${job.openReminderCount} reminder${job.openReminderCount === 1 ? "" : "s"}`;
  }

  return formatTier(job.score?.tier);
}

function queueMeta(job: JobListItem, kind: QueueKind) {
  if (kind === "followUp") {
    return `${job.company?.name ?? "Company pending parse"} | ${job.application?.status ?? "not created"}`;
  }

  if (kind === "shortlist") {
    return `${job.company?.name ?? "Company pending parse"} | Score ${job.score?.overallScore ?? "n/a"}`;
  }

  return `${job.company?.name ?? "Company pending parse"} | ${formatRecommendation(job.score?.recommendation)}`;
}

function JobQueueList({ title, jobs, kind, emptyMessage }: JobQueueListProps) {
  const mutationStatus = getHostedPreviewMutationStatus();

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
          {title}
        </div>
        <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
          {jobs.length}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
            {emptyMessage}
          </div>
        ) : (
          jobs.slice(0, 5).map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-[var(--border)] bg-white/80 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/jobs/${job.id}`} className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline">
                    {job.title}
                  </Link>
                  {job.sourceUrl ? (
                    <div className="mt-2">
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-[var(--accent)] underline"
                      >
                        Open original posting
                      </a>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                  {queueBadge(job, kind)}
                </div>
              </div>
              <div className="mt-1 text-[var(--muted)]">{queueMeta(job, kind)}</div>
              {job.duplicateCount > 0 ? (
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Also seen via {formatAlternateSources(job.alternateSources)}.
                </div>
              ) : null}
              <div className="mt-2 text-[var(--muted)]">{queueBody(job, kind)}</div>
              {kind === "needsTier1" ? (
                <form action={runTier1AnalysisAction} className="mt-3">
                  <input type="hidden" name="jobId" value={job.id} />
                  <button
                    type="submit"
                    disabled={!mutationStatus.writesAllowed}
                    className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Run Tier 1 now
                  </button>
                </form>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  await ensureDefaultRecords();
  const params = searchParams ? await searchParams : undefined;
  const [queues, budget] = await Promise.all([getJobQueueSnapshot(), getAiBudgetSettings()]);
  const mutationStatus = getHostedPreviewMutationStatus();

  return (
    <PageFrame
      eyebrow="Full-Time Pipeline"
      title="Ingest, rank, and decide what deserves your attention."
      description="The jobs pipeline now separates raw imports from the real decision queues so you can see what still needs richer analysis, what belongs on the shortlist, and what deserves follow-up."
      metrics={[
        {
          label: "Unique Jobs",
          value: String(queues.allJobs.length),
          hint: "Canonical opportunities after cross-source dedupe suppression.",
        },
        {
          label: "Needs Tier 1",
          value: String(queues.needsTier1.length),
          hint: "Active jobs that still only have the fast first-pass score.",
        },
        {
          label: "Browser Matches",
          value: String(queues.recentBrowserMatches.length),
          hint: "Canonical browser-backed roles discovered in the last 24 hours.",
        },
        {
          label: "Duplicates Suppressed",
          value: String(queues.duplicateSuppressedCount),
          hint: "Extra rows folded into stronger canonical job cards.",
        },
        {
          label: "Deep Review",
          value: String(queues.deepReview.length),
          hint: "Jobs with enough upside or ambiguity to justify a higher-context review later.",
        },
        {
          label: "Deep Analysis",
          value: budget?.neverAutoRunDeepAnalysis ? "Approval Only" : "Open",
          hint: "Tier 2 stays locked unless you explicitly approve it.",
        },
      ]}
    >
      {params?.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow)] ${
            params.status === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : params.status === "warning"
                ? "border-amber-300 bg-amber-50 text-amber-950"
                : "border-emerald-300 bg-emerald-50 text-emerald-950"
          }`}
        >
          {params.message}
        </div>
      ) : null}

      {mutationStatus.readOnlyHostedPreview ? (
        <ReadOnlyNotice message={mutationStatus.message} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.5fr]">
        <InfoCard
          title="Manual import"
          body="Paste a job URL to create a real record now. If the page blocks automatic fetch, you can still provide title, company, and description manually."
        >
          <form action={importJobAction}>
            <fieldset
              disabled={!mutationStatus.writesAllowed}
              className={`space-y-3 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
            >
              <input
                name="url"
                type="url"
                required
                placeholder="https://example.com/jobs/operations-manager"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="manualTitle"
                  type="text"
                  placeholder="Manual title fallback"
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                />
                <input
                  name="manualCompany"
                  type="text"
                  placeholder="Manual company fallback"
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                />
              </div>
              <input
                name="manualLocation"
                type="text"
                placeholder="Manual location fallback"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
              <textarea
                name="rawDescription"
                rows={5}
                placeholder="Optional pasted job description if the page is blocked or incomplete"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Import and score job
              </button>
            </fieldset>
          </form>
        </InfoCard>

        <InfoCard
          title="Decision queues"
          body="Use these queues to decide whether a job needs a richer analysis pass, belongs on the shortlist, deserves deeper review, or should move into follow-up work."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <JobQueueList
              title="Needs Tier 1"
              jobs={queues.needsTier1}
              kind="needsTier1"
              emptyMessage="No active jobs are waiting for Tier 1 analysis."
            />
            <JobQueueList
              title="Shortlist"
              jobs={queues.shortlist}
              kind="shortlist"
              emptyMessage="No jobs are close enough to tailoring yet."
            />
            <JobQueueList
              title="Deep Review"
              jobs={queues.deepReview}
              kind="deepReview"
              emptyMessage="No jobs are currently flagged for deep review."
            />
            <JobQueueList
              title="Follow-Up"
              jobs={queues.followUp}
              kind="followUp"
              emptyMessage="No reminder-driven follow-up work is pending."
            />
          </div>
        </InfoCard>
      </div>

      <InfoCard
        title="All imported jobs"
        body="Each card now represents the canonical version of a role. Cross-source duplicates stay available in history, but the main pipeline stays focused on the strongest posting."
      >
        <div className="space-y-3">
          {queues.allJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4 text-sm text-[var(--muted)]">
              No jobs imported yet. Start with a manual URL to create the first tracked record.
            </div>
          ) : (
            queues.allJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border border-[var(--border)] bg-white/70 p-4 transition hover:bg-white"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link href={`/jobs/${job.id}`} className="text-lg font-semibold underline-offset-4 hover:underline">
                      {job.title}
                    </Link>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {job.company?.name ?? "Company pending parse"} | {job.locationText ?? "Location pending parse"}
                    </div>
                    {job.sourceUrl ? (
                      <div className="mt-2">
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-[var(--accent)] underline"
                        >
                          Open original posting
                        </a>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium capitalize text-[var(--accent)]">
                      {formatRecommendation(job.score?.recommendation)}
                    </div>
                    <div className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-medium capitalize text-[var(--foreground)]">
                      {job.currentStage}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                  <span>Score: {job.score?.overallScore ?? "n/a"}</span>
                  <span>Latest tier: {formatTier(job.score?.tier)}</span>
                  <span>Primary source: {job.source.replaceAll("_", " ")}</span>
                  {job.duplicateCount > 0 ? (
                    <span>
                      Also seen via {formatAlternateSources(job.alternateSources)} ({job.duplicateCount} duplicate{job.duplicateCount === 1 ? "" : "s"} suppressed)
                    </span>
                  ) : null}
                  {job.score?.recommendedResumeType ? (
                    <span>Resume lane: {job.score.recommendedResumeType.replaceAll("_", " ")}</span>
                  ) : null}
                  {job.openReminderCount > 0 ? <span>{job.openReminderCount} open reminders</span> : null}
                  {job.application ? <span>Application: {job.application.status}</span> : null}
                </div>
                <div className="mt-3 text-sm text-[var(--muted)]">
                  {job.score?.deepReviewReason ?? job.score?.summary ?? "No score summary saved yet."}
                </div>
              </div>
            ))
          )}
        </div>
      </InfoCard>
    </PageFrame>
  );
}
