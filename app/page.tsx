import Link from "next/link";

import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getInboxSummary } from "@/lib/inbox/queries";
import {
  getAiUsageSummary,
  getJobQueueSnapshot,
  type JobQueueSnapshot,
} from "@/lib/jobs/queries";

function formatRecommendation(value?: string | null) {
  return (value ?? "review").replaceAll("_", " ");
}

function formatAlternateSources(sources: string[]) {
  return sources.map((source) => source.replaceAll("_", " ")).join(", ");
}

function JobQueueCard({
  job,
  metadata,
}: {
  job: JobQueueSnapshot["activeJobs"][number];
  metadata: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/jobs/${job.id}`}
          className="font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          {job.title}
        </Link>
        {job.sourceUrl ? (
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)] transition hover:opacity-80"
          >
            Original post
          </a>
        ) : null}
      </div>
      <div className="mt-1 text-[var(--muted)]">{metadata}</div>
      {job.duplicateCount > 0 ? (
        <div className="mt-1 text-xs text-[var(--muted)]">
          Also seen via {formatAlternateSources(job.alternateSources)}.
        </div>
      ) : null}
      <div className="mt-2 text-[var(--muted)]">
        {job.score?.summary ?? "No summary has been saved yet."}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  await ensureDefaultRecords();
  const [queues, usage] = await Promise.all([getJobQueueSnapshot(), getAiUsageSummary()]);
  const inboxSummary = await getInboxSummary();

  return (
    <PageFrame
      eyebrow="Launchpad"
      title="Build the search engine before the noise reaches you."
      description="The dashboard now centers the real decision queues: what still needs richer analysis, what belongs on the shortlist, what deserves deeper review, and what needs follow-up."
      metrics={[
        {
          label: "Active Jobs",
          value: String(queues.activeJobs.length),
          hint: "Open opportunities still in play across review, tailoring, and application stages.",
        },
        {
          label: "Needs Tier 1",
          value: String(queues.needsTier1.length),
          hint: "Jobs still running only on Tier 0 signals that are good enough to justify a richer pass.",
        },
        {
          label: "Shortlist",
          value: String(queues.shortlist.length),
          hint: "Opportunities currently closest to tailoring or application work.",
        },
        {
          label: "New Replies",
          value: String(inboxSummary.unreviewedActionable),
          hint: "Matched inbox activity that still needs review.",
        },
        {
          label: "Browser Matches",
          value: String(queues.recentBrowserMatches.length),
          hint: "Canonical browser-sourced roles discovered in the last 24 hours.",
        },
        {
          label: "Duplicates Suppressed",
          value: String(queues.duplicateSuppressedCount),
          hint: "Cross-source duplicates rolled into a single canonical job record.",
        },
        {
          label: "AI Spend",
          value: `$${usage.spent.toFixed(4)}`,
          hint: `${usage.requests} analysis runs logged this month.`,
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <InfoCard
          title="Decision queues are now live"
          body="Tier 0 still gives the fast first-pass sort, but the dashboard now separates jobs that need deeper analysis from the ones already worth tailoring or following up on."
        />
        <InfoCard
          title="Deep review policy"
          body="Tier 2 never runs automatically. Jobs can be recommended for deeper review, but you will always see why and approve the spend before it happens."
        />
        <InfoCard
          title="Duplicate suppression"
          body={
            queues.duplicateSuppressedCount > 0
              ? `${queues.duplicateSuppressedCount} overlapping browser or board imports are now folded into stronger canonical job records so the queues stay readable.`
              : "No cross-source duplicate collisions are being suppressed right now."
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <InfoCard
          title="Needs Tier 1"
          body="These jobs survived the first pass, but they are still relying on Tier 0 heuristics rather than a richer structured analysis."
        >
          <div className="space-y-3">
            {queues.needsTier1.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No active jobs are waiting on a Tier 1 pass right now.
              </div>
            ) : (
              queues.needsTier1.slice(0, 5).map((job) => (
                <JobQueueCard
                  key={job.id}
                  job={job}
                  metadata={`${job.company?.name ?? "Company pending parse"} | ${formatRecommendation(job.score?.recommendation)}`}
                />
              ))
            )}
          </div>
        </InfoCard>

        <InfoCard
          title="Shortlist"
          body="These jobs are the closest to tailoring, draft generation, or creating a real application record."
        >
          <div className="space-y-3">
            {queues.shortlist.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No jobs are on the shortlist yet.
              </div>
            ) : (
              queues.shortlist.slice(0, 5).map((job) => (
                <JobQueueCard
                  key={job.id}
                  job={job}
                  metadata={`${job.company?.name ?? "Company pending parse"} | Score ${job.score?.overallScore ?? "n/a"}`}
                />
              ))
            )}
          </div>
        </InfoCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <InfoCard
          title="Fresh Browser Matches"
          body="Browser-backed collectors now surface their latest canonical matches here, with duplicate cross-posts folded into a single role."
        >
          <div className="space-y-3">
            {queues.recentBrowserMatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No browser-backed matches landed in the last 24 hours.
              </div>
            ) : (
              queues.recentBrowserMatches.slice(0, 5).map((job) => (
                <JobQueueCard
                  key={job.id}
                  job={job}
                  metadata={`${job.company?.name ?? "Company pending parse"} | ${job.source.replaceAll("_", " ")}${job.locationText ? ` | ${job.locationText}` : ""}`}
                />
              ))
            )}
          </div>
        </InfoCard>

        <InfoCard
          title="New Replies"
          body="Fresh matched inbox activity lands here until you review it, so employer responses are visible alongside the rest of the work queue."
        >
          <div className="space-y-3">
            {inboxSummary.attentionQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No new inbox replies are waiting right now.
              </div>
            ) : (
              inboxSummary.attentionQueue.map(({ message, job, company }) => (
                <div
                  key={message.id}
                  className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    {job ? (
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]"
                      >
                        {job.title}
                      </Link>
                    ) : (
                      <div className="font-medium text-[var(--foreground)]">
                        {message.subject}
                      </div>
                    )}
                    <Link
                      href="/settings/inbox"
                      className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)] transition hover:opacity-80"
                    >
                      Inbox
                    </Link>
                  </div>
                  <div className="mt-1 text-[var(--muted)]">
                    {company?.name ?? message.senderEmail} |{" "}
                    {message.messageType.replaceAll("_", " ")}
                  </div>
                  <div className="mt-2 text-[var(--muted)]">
                    {message.subject}
                  </div>
                </div>
              ))
            )}
          </div>
        </InfoCard>

        <InfoCard
          title="Deep Review Candidates"
          body="These jobs show enough upside or ambiguity that a more expensive, higher-context review may be worth approving later."
        >
          <div className="space-y-3">
            {queues.deepReview.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No jobs are currently flagged for deep review.
              </div>
            ) : (
              queues.deepReview.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]"
                    >
                      {job.title}
                    </Link>
                    {job.sourceUrl ? (
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)] transition hover:opacity-80"
                      >
                        Original post
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[var(--muted)]">
                    {job.company?.name ?? "Company pending parse"} | {job.score?.tier ?? "tier_0"}
                  </div>
                  <div className="mt-2 text-[var(--muted)]">
                    {job.score?.deepReviewReason ??
                      "This job would benefit from a closer, higher-context fit review."}
                  </div>
                </div>
              ))
            )}
          </div>
        </InfoCard>

        <InfoCard
          title="Follow-Up Queue"
          body="Reminders and post-application follow-ups stay visible here so they do not get buried under fresh inbound jobs."
        >
          <div className="space-y-3">
            {queues.followUp.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No follow-up work is pending.
              </div>
            ) : (
              queues.followUp.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]"
                    >
                      {job.title}
                    </Link>
                    {job.sourceUrl ? (
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)] transition hover:opacity-80"
                      >
                        Original post
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[var(--muted)]">
                    {job.company?.name ?? "Company pending parse"} | {job.openReminderCount} open reminder{job.openReminderCount === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 text-[var(--muted)]">
                    {job.nextReminderAt
                      ? `Next reminder ${new Date(job.nextReminderAt).toLocaleString()}`
                      : `Application status: ${job.application?.status ?? "not created"}`}
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
