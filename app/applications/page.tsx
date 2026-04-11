import Link from "next/link";

import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { listApplications, listJobs } from "@/lib/jobs/queries";

const stages = [
  "new",
  "review",
  "tailoring",
  "ready",
  "applied",
  "follow-up",
  "interview",
  "closed",
] as const;

type ApplicationsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  await ensureDefaultRecords();
  const jobs = listJobs();
  const applicationRows = listApplications();
  const params = searchParams ? await searchParams : undefined;

  return (
    <PageFrame
      eyebrow="Application Tracker"
      title="Track movement, not just intent."
      description="This board will handle application stages, notes, follow-ups, and the work that also flows into your Linear vault."
      metrics={[
        {
          label: "Digest Cadence",
          value: "2x Daily",
          hint: "In-app summaries are planned for 8 AM and 8 PM Eastern.",
        },
      ]}
    >
      {params?.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow)] ${
            params.status === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-950"
          }`}
        >
          {params.message}
        </div>
      ) : null}

      <InfoCard
        title="Stages"
        body="New, Review, Tailoring, Ready, Applied, Follow-Up, Interview, and Closed anchor the first tracker pass."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          {stages.map((stage) => {
            const stageJobs = jobs.filter((job) => job.currentStage === stage);

            return (
              <div
                key={stage}
                className="rounded-2xl border border-[var(--border)] bg-white/65 p-4"
              >
                <div className="text-sm font-semibold capitalize text-[var(--foreground)]">
                  {stage}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {stageJobs.length} jobs
                </div>
                <div className="mt-4 space-y-3">
                  {stageJobs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                      Nothing in this stage yet.
                    </div>
                  ) : (
                    stageJobs.map((job) => (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="block rounded-xl border border-[var(--border)] bg-white p-3 text-sm transition hover:bg-[var(--surface-strong)]"
                      >
                        <div className="font-medium text-[var(--foreground)]">
                          {job.title}
                        </div>
                        <div className="mt-1 text-[var(--muted)]">
                          {job.company?.name ?? "Company pending parse"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                          <span>{job.noteCount} notes</span>
                          <span>{job.openReminderCount} open reminders</span>
                          <span>
                            App: {job.application ? job.application.status : "not created"}
                          </span>
                          <span>
                            Drafts:{" "}
                            {job.application?.resumeDocId || job.application?.coverLetterDocId
                              ? "linked"
                              : "not linked"}
                          </span>
                          {job.nextReminderAt ? (
                            <span>
                              Next: {new Date(job.nextReminderAt).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </InfoCard>

      <InfoCard
        title="Application Records"
        body="This is the first real post-apply workflow layer: linked drafts, submission metadata, and application-specific status."
      >
        <div className="space-y-3">
          {applicationRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
              No application records yet. Create one from a shortlisted job or tailoring workspace.
            </div>
          ) : (
            applicationRows.map(({ application, job, company, resumeStrategy, coverLetter }) => (
              <Link
                key={application.id}
                href={`/jobs/${application.jobId}`}
                className="block rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm transition hover:bg-white"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-[var(--foreground)]">
                      {job?.title ?? "Job missing"}
                    </div>
                    <div className="mt-1 text-[var(--muted)]">
                      {company?.name ?? "Company pending parse"} · {application.platform ?? "unknown platform"}
                    </div>
                  </div>
                  <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-medium capitalize text-[var(--accent)]">
                    {application.status}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                  <span>
                    Submitted:{" "}
                    {application.submittedAt
                      ? new Date(application.submittedAt).toLocaleString()
                      : "not yet"}
                  </span>
                  <span>Resume strategy: {resumeStrategy ? "linked" : "missing"}</span>
                  <span>Cover letter: {coverLetter ? "linked" : "missing"}</span>
                  {application.submissionReference ? (
                    <span>Reference: {application.submissionReference}</span>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </InfoCard>
    </PageFrame>
  );
}
