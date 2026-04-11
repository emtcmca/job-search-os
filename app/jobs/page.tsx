import Link from "next/link";

import { importJobAction } from "@/app/jobs/actions";
import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getAiBudgetSettings, listJobs } from "@/lib/jobs/queries";

type JobsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  await ensureDefaultRecords();
  const params = searchParams ? await searchParams : undefined;
  const jobs = listJobs();
  const budget = getAiBudgetSettings();

  return (
    <PageFrame
      eyebrow="Full-Time Pipeline"
      title="Ingest, rank, and decide what deserves your attention."
      description="This view will hold normalized job listings, hard filters, fit scores, and recommendation states like Skip, Review, Tailor, and Deep Review Recommended."
      metrics={[
        {
          label: "Default Analysis",
          value: "Tier 0",
          hint: "Rule-based parsing and heuristics run before any paid analysis.",
        },
        {
          label: "Priority ATS",
          value: "3",
          hint: "Greenhouse, Lever, and Workday are first-class targets.",
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <InfoCard
          title="Manual import"
          body="Paste a job URL to create a real record now. If the page blocks automatic fetch, you can still provide title, company, and description manually."
        >
          <form action={importJobAction} className="space-y-3">
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
              className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white"
            >
              Import and score job
            </button>
          </form>
        </InfoCard>

        <InfoCard
          title="Imported jobs"
          body="The list below is now database-backed. Each record stores a normalized job, its latest snapshot, and the current Tier 0 recommendation."
        >
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/60 p-4 text-sm text-[var(--muted)]">
                No jobs imported yet. Start with a manual URL to create the first tracked record.
              </div>
            ) : (
              jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block rounded-2xl border border-[var(--border)] bg-white/70 p-4 transition hover:bg-white"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-lg font-semibold">{job.title}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {job.company?.name ?? "Company pending parse"} ·{" "}
                        {job.locationText ?? "Location pending parse"}
                      </div>
                    </div>
                    <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium capitalize text-[var(--accent)]">
                      {(job.score?.recommendation ?? "review").replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                    <span>Score: {job.score?.overallScore ?? "n/a"}</span>
                    <span>Stage: {job.currentStage}</span>
                    <span>Source: {job.source}</span>
                    {job.score?.recommendedResumeType ? (
                      <span>
                        Resume: {job.score.recommendedResumeType.replaceAll("_", " ")}
                      </span>
                    ) : null}
                    {job.score?.deepReviewRecommended ? (
                      <span>Deep review recommended</span>
                    ) : null}
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
