import Link from "next/link";
import { notFound } from "next/navigation";

import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import {
  addJobNoteAction,
  addJobReminderAction,
  runTier1AnalysisAction,
  updateJobStageAction,
  updateReminderStatusAction,
} from "@/app/jobs/actions";
import {
  createApplicationFromJobAction,
  updateApplicationAction,
} from "@/app/applications/actions";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getAiBudgetSettings, getAiUsageSummary, getJobDetail } from "@/lib/jobs/queries";
import { estimateTier1Cost } from "@/lib/ai/config";

type JobDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function JobDetailPage({
  params,
  searchParams,
}: JobDetailPageProps) {
  await ensureDefaultRecords();
  const { id } = await params;
  const parsedId = Number(id);
  const detail = Number.isFinite(parsedId) ? getJobDetail(parsedId) : null;
  const status = searchParams ? await searchParams : undefined;
  const budget = getAiBudgetSettings();
  const usage = getAiUsageSummary();

  if (!detail) {
    notFound();
  }

  const reasonsFor = detail.score?.reasonsForJson
    ? (JSON.parse(detail.score.reasonsForJson) as string[])
    : [];
  const reasonsAgainst = detail.score?.reasonsAgainstJson
    ? (JSON.parse(detail.score.reasonsAgainstJson) as string[])
    : [];
  const tier1Estimate = estimateTier1Cost(detail.snapshot?.rawText ?? "", 700);
  const projectedSpend = usage.spent + tier1Estimate.estimatedCost;

  return (
    <PageFrame
      eyebrow="Job Detail"
      title={detail.job.title}
      description="This page will combine the posting snapshot, score breakdown, company signals, suggested resume baseline, and actions for tailoring or application tracking."
      metrics={[
        {
          label: "Tier",
          value: detail.score?.tier ?? "tier_0",
          hint: "Deep analysis remains approval-gated.",
        },
        {
          label: "Recommendation",
          value: (detail.score?.recommendation ?? "review").replaceAll("_", " "),
          hint: "Current next-best action from the scoring layer.",
        },
        {
          label: "Score",
          value: detail.score?.overallScore?.toFixed(0) ?? "n/a",
          hint: "Tier 0 fit score from rule-based heuristics.",
        },
      ]}
    >
      {status?.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow)] ${
            status.status === "warning"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-emerald-300 bg-emerald-50 text-emerald-950"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard
          title="Snapshot and parsing"
          body="Raw posting text, parsed metadata, and change history live here so the system can avoid duplicate spend on unchanged jobs."
        >
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <div>
              <span className="font-medium text-[var(--foreground)]">Company:</span>{" "}
              {detail.company?.name ?? "Pending parse"}
            </div>
            <div>
              <span className="font-medium text-[var(--foreground)]">Location:</span>{" "}
              {detail.job.locationText ?? "Pending parse"}{" "}
              {detail.job.locationType ? `(${detail.job.locationType})` : ""}
            </div>
            <div>
              <span className="font-medium text-[var(--foreground)]">Employment:</span>{" "}
              {detail.job.employmentType ?? "Unknown"}
            </div>
            <div>
              <span className="font-medium text-[var(--foreground)]">Source URL:</span>{" "}
              <a
                className="text-[var(--accent)] underline"
                href={detail.job.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open source posting
              </a>
            </div>
            <div className="max-h-80 overflow-auto rounded-2xl border border-[var(--border)] bg-white/70 p-4 leading-6">
              {detail.snapshot?.rawText || "No raw snapshot text stored yet."}
            </div>
          </div>
        </InfoCard>
        <InfoCard
          title="Decision support"
          body={detail.score?.summary ?? "No score summary has been generated yet."}
        >
          {detail.application ? (
            <div className="mb-4 rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm text-[var(--muted)]">
              <div className="font-medium text-[var(--foreground)]">
                Application record linked
              </div>
              <div className="mt-1 leading-6">
                Status: {detail.application.status} · Platform: {detail.application.platform ?? "unknown"}
              </div>
              <div className="mt-1 leading-6">
                Resume strategy attached: {detail.application.resumeDocId ? "yes" : "no"} · Cover letter attached: {detail.application.coverLetterDocId ? "yes" : "no"}
              </div>
              {detail.application.submittedAt ? (
                <div className="mt-1 leading-6">
                  Submitted: {new Date(detail.application.submittedAt).toLocaleString()}
                </div>
              ) : null}
              {detail.application.submissionReference ? (
                <div className="mt-1 leading-6">
                  Reference: {detail.application.submissionReference}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm text-[var(--muted)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-medium text-[var(--foreground)]">
                  Tier 1 low-cost analysis
                </div>
                <div className="mt-1 leading-6">
                  Runs only when you request it. Estimated spend is about $
                  {tier1Estimate.estimatedCost.toFixed(4)} for this job, with $
                  {usage.spent.toFixed(4)} spent so far this month.
                </div>
                <div className="mt-1 leading-6">
                  Projected monthly spend after this run: $
                  {projectedSpend.toFixed(4)} of $
                  {(budget?.monthlyBudget ?? 25).toFixed(2)}.
                </div>
                {detail.score?.recommendedResumeType ? (
                  <div className="mt-1 leading-6">
                    Recommended resume lane:{" "}
                    {detail.score.recommendedResumeType.replaceAll("_", " ")}.
                  </div>
                ) : null}
                {detail.score?.deepReviewRecommended ? (
                  <div className="mt-1 leading-6">
                    Deep review recommended:{" "}
                    {detail.score.deepReviewReason ??
                      "The model found enough ambiguity or upside to justify a deeper pass."}
                  </div>
                ) : null}
              </div>
              <form action={runTier1AnalysisAction}>
                <input type="hidden" name="jobId" value={detail.job.id} />
                <button
                  type="submit"
                  className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)]"
                >
                  Run Tier 1 analysis
                </button>
              </form>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <form action={updateJobStageAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="jobId" value={detail.job.id} />
              <select
                name="stage"
                defaultValue={detail.job.currentStage}
                className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="new">New</option>
                <option value="review">Review</option>
                <option value="tailoring">Tailoring</option>
                <option value="ready">Ready</option>
                <option value="applied">Applied</option>
                <option value="follow-up">Follow-Up</option>
                <option value="interview">Interview</option>
                <option value="closed">Closed</option>
              </select>
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Update stage
              </button>
            </form>
            <Link
              href={`/tailor/${detail.job.id}`}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium"
            >
              Open tailoring workspace
            </Link>
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
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-[var(--foreground)]">Reasons For</div>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-[var(--muted)]">
                {reasonsFor.length === 0 ? (
                  <li>No positive factors captured yet.</li>
                ) : (
                  reasonsFor.map((reason) => <li key={reason}>{reason}</li>)
                )}
              </ul>
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--foreground)]">Reasons Against</div>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-[var(--muted)]">
                {reasonsAgainst.length === 0 ? (
                  <li>No caution flags captured yet.</li>
                ) : (
                  reasonsAgainst.map((reason) => <li key={reason}>{reason}</li>)
                )}
              </ul>
            </div>
          </div>
        </InfoCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <InfoCard
          title="Notes"
          body="Capture the why behind your decisions so the app can later learn from saved, skipped, and pursued opportunities."
        >
          <form action={addJobNoteAction} className="space-y-3">
            <input type="hidden" name="jobId" value={detail.job.id} />
            <textarea
              name="body"
              rows={4}
              placeholder="Add a note about fit, concerns, company research, or next steps"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Save note
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {detail.notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No notes yet.
              </div>
            ) : (
              detail.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                >
                  <div className="whitespace-pre-wrap leading-6 text-[var(--foreground)]">
                    {note.body}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </InfoCard>

        <InfoCard
          title="Reminders"
          body="Keep follow-ups and time-sensitive actions close to the job record so the tracker can surface them cleanly."
        >
          <form action={addJobReminderAction} className="space-y-3">
            <input type="hidden" name="jobId" value={detail.job.id} />
            <input
              name="title"
              type="text"
              placeholder="Follow up with recruiter"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <input
              name="dueAt"
              type="datetime-local"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Add reminder
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {detail.reminders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No reminders yet.
              </div>
            ) : (
              detail.reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--foreground)]">
                        {reminder.title}
                      </div>
                      <div className="mt-1 text-[var(--muted)]">
                        Due {new Date(reminder.dueAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                      {reminder.status}
                    </div>
                  </div>
                  <form action={updateReminderStatusAction} className="mt-3 flex gap-2">
                    <input type="hidden" name="jobId" value={detail.job.id} />
                    <input type="hidden" name="reminderId" value={reminder.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={reminder.status === "done" ? "open" : "done"}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
                    >
                      {reminder.status === "done" ? "Reopen" : "Mark done"}
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </InfoCard>
      </div>

      {detail.applicationHistory.length > 0 ? (
        <InfoCard
          title="Application History"
          body="This event log will become the backbone for later Linear sync and ATS assistance."
        >
          <div className="space-y-3">
            {detail.applicationHistory.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
              >
                <div className="font-medium text-[var(--foreground)]">
                  {event.eventType.replaceAll("_", " ")}
                </div>
                <div className="mt-1 text-[var(--muted)]">
                  {new Date(event.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </InfoCard>
      ) : null}

      {detail.application ? (
        <InfoCard
          title="Submission Workflow"
          body="Use this section to move from ready-to-apply into real post-submission tracking."
        >
          <form action={updateApplicationAction} className="grid gap-4 xl:grid-cols-2">
            <input type="hidden" name="applicationId" value={detail.application.id} />
            <input type="hidden" name="jobId" value={detail.job.id} />
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Application status
              <select
                name="status"
                defaultValue={detail.application.status}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              >
                <option value="ready">Ready</option>
                <option value="applied">Applied</option>
                <option value="follow-up">Follow-Up</option>
                <option value="interview">Interview</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Platform
              <input
                name="platform"
                type="text"
                defaultValue={detail.application.platform ?? detail.job.source}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Submitted at
              <input
                name="submittedAt"
                type="datetime-local"
                defaultValue={
                  detail.application.submittedAt
                    ? new Date(detail.application.submittedAt).toISOString().slice(0, 16)
                    : ""
                }
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Submission URL
              <input
                name="submissionUrl"
                type="url"
                defaultValue={detail.application.submissionUrl ?? ""}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Reference number
              <input
                name="submissionReference"
                type="text"
                defaultValue={detail.application.submissionReference ?? ""}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)] xl:col-span-2">
              Application notes
              <textarea
                name="applicationNotes"
                rows={4}
                defaultValue={detail.application.notes ?? ""}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <div className="xl:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Save application workflow
              </button>
            </div>
          </form>
        </InfoCard>
      ) : null}
    </PageFrame>
  );
}
