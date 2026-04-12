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

function describeDraftPacket(input: {
  hasCompleteDraftPacket: boolean;
  missingDocuments: string[];
}) {
  if (input.hasCompleteDraftPacket) {
    return "ready packet";
  }

  return `missing ${input.missingDocuments.join(", ")}`;
}

function describeReadiness(input: {
  readyToSubmit: boolean;
  missingReadyItems: string[];
}) {
  if (input.readyToSubmit) {
    return "ready to submit";
  }

  return `blocked by ${input.missingReadyItems.join(", ")}`;
}

export default async function ApplicationsPage({
  searchParams,
}: ApplicationsPageProps) {
  await ensureDefaultRecords();
  const [jobs, applicationRows] = await Promise.all([listJobs(), listApplications()]);
  const params = searchParams ? await searchParams : undefined;
  const gaps = applicationRows.filter(
    ({ draftPacket }) => !draftPacket.hasCompleteDraftPacket,
  ).length;
  const readyToSubmit = applicationRows.filter(
    ({ applicationReadiness }) => applicationReadiness.readyToSubmit,
  ).length;

  return (
    <PageFrame
      eyebrow="Application Tracker"
      title="Track movement, not just intent."
      description="This board will handle application stages, notes, follow-ups, and the work that also flows into your Linear vault."
      metrics={[
        {
          label: "Application Records",
          value: String(applicationRows.length),
          hint: "Jobs that already have a dedicated application workflow record.",
        },
        {
          label: "Ready To Submit",
          value: String(readyToSubmit),
          hint: "Application records that pass the final submission gate.",
        },
        {
          label: "Draft Gaps",
          value: String(gaps),
          hint: "Application records still missing part of the packet needed for a clean ready-to-apply state.",
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
                      <div
                        key={job.id}
                        className="rounded-xl border border-[var(--border)] bg-white p-3 text-sm"
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
                      </div>
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
        body="This layer now makes packet gaps visible, so you can tell which records are actually ready to apply and which still need draft work or a refresh to the latest generated documents."
      >
        <div className="space-y-3">
          {applicationRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
              No application records yet. Create one from a shortlisted job or tailoring workspace.
            </div>
          ) : (
            applicationRows.map(
              ({
                application,
                job,
                company,
                resumeStrategy,
                coverLetter,
                draftPacket,
                applicationReadiness,
              }) => (
                <div
                  key={application.id}
                  className="rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/jobs/${application.jobId}`}
                          className="text-lg font-semibold text-[var(--foreground)] transition hover:text-[var(--accent)]"
                        >
                          {job?.title ?? "Job missing"}
                        </Link>
                        {job?.sourceUrl ? (
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
                        {company?.name ?? "Company pending parse"} | {application.platform ?? "unknown platform"}
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
                    <span>Packet: {describeDraftPacket(draftPacket)}</span>
                    <span>Gate: {describeReadiness(applicationReadiness)}</span>
                    {draftPacket.needsResumeRefresh || draftPacket.needsCoverLetterRefresh ? (
                      <span>Links need refresh</span>
                    ) : null}
                    {application.followUpRequired ? <span>Follow-up required</span> : null}
                    {application.submissionReference ? (
                      <span>Reference: {application.submissionReference}</span>
                    ) : null}
                  </div>
                  <div className="mt-3 text-sm text-[var(--muted)]">
                    {applicationReadiness.readyToSubmit
                      ? "This application passes the final submission gate."
                      : `Still missing: ${applicationReadiness.missingReadyItems.join(", ")}.`}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </InfoCard>
    </PageFrame>
  );
}
