import Link from "next/link";

import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getAiUsageSummary, listJobs } from "@/lib/jobs/queries";

export default async function DashboardPage() {
  await ensureDefaultRecords();
  const jobs = listJobs();
  const usage = getAiUsageSummary();
  const deepReviewJobs = jobs.filter((job) => job.score?.deepReviewRecommended);
  const tailoringJobs = jobs.filter((job) => job.score?.recommendation === "tailor");

  return (
    <PageFrame
      eyebrow="Launchpad"
      title="Build the search engine before the noise reaches you."
      description="This dashboard will become the daily command center for new matches, follow-ups, budget-aware AI recommendations, and Linear-linked action queues."
      metrics={[
        {
          label: "Tracked Jobs",
          value: String(jobs.length),
          hint: "Imported opportunities currently stored locally.",
        },
        {
          label: "AI Spend",
          value: `$${usage.spent.toFixed(4)}`,
          hint: `${usage.requests} analysis runs logged this month.`,
        },
        {
          label: "Linear Pipelines",
          value: "2",
          hint: "Full-Time and Freelance stay separated operationally.",
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <InfoCard
          title="Next implementation slice"
          body="The first vertical path is live. Next up is turning the richer Tier 1 output into stronger shortlist and deep-review queues."
        />
        <InfoCard
          title="Deep review policy"
          body="Tier 2 never runs automatically. Jobs can be recommended for deeper review, but you will always see why and approve the spend before it happens."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <InfoCard
          title="Ready to tailor"
          body="These jobs currently look strong enough to justify tailoring work."
        >
          <div className="space-y-3">
            {tailoringJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No jobs have crossed the tailoring threshold yet.
              </div>
            ) : (
              tailoringJobs.slice(0, 5).map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm transition hover:bg-white"
                >
                  <div className="font-medium text-[var(--foreground)]">{job.title}</div>
                  <div className="mt-1 text-[var(--muted)]">
                    {(job.company?.name ?? "Company pending parse") +
                      (job.score?.recommendedResumeType
                        ? ` · ${job.score.recommendedResumeType.replaceAll("_", " ")}`
                        : "")}
                  </div>
                </Link>
              ))
            )}
          </div>
        </InfoCard>

        <InfoCard
          title="Recommended for deep review"
          body="These jobs show enough upside or ambiguity that a deeper review may be worth approving later."
        >
          <div className="space-y-3">
            {deepReviewJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No jobs are currently flagged for deep review.
              </div>
            ) : (
              deepReviewJobs.slice(0, 5).map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm transition hover:bg-white"
                >
                  <div className="font-medium text-[var(--foreground)]">{job.title}</div>
                  <div className="mt-1 text-[var(--muted)]">
                    {job.score?.deepReviewReason ??
                      "This job would benefit from a closer, higher-context fit review."}
                  </div>
                </Link>
              ))
            )}
          </div>
        </InfoCard>
      </div>
    </PageFrame>
  );
}
