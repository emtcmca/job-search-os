import Link from "next/link";
import { notFound } from "next/navigation";

import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import {
  addJobNoteAction,
  addJobReminderAction,
  runTier1AnalysisAction,
  updateJobStageAction,
  updateReminderStatusAction,
} from "@/app/jobs/actions";
import {
  createApplicationFromJobAction,
  logApplicationEventAction,
  updateApplicationAction,
} from "@/app/applications/actions";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getAiBudgetSettings, getAiUsageSummary, getJobDetail } from "@/lib/jobs/queries";
import { getHostedPreviewMutationStatus } from "@/lib/runtime/deployment";
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

function parseReasonList(raw?: string | null) {
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function formatRecommendation(value?: string | null) {
  return (value ?? "review").replaceAll("_", " ");
}

function formatTier(value?: string | null) {
  return (value ?? "tier_0").replaceAll("_", " ");
}

function formatDocumentType(value: string) {
  return value.replaceAll("_", " ");
}

function formatSourceLabel(value?: string | null) {
  return (value ?? "unknown").replaceAll("_", " ");
}

function parseEventPayload(raw: string) {
  try {
    return JSON.parse(raw) as {
      summary?: string | null;
      details?: string | null;
      occurredAt?: string | null;
      reminderDueAt?: string | null;
      submissionUrl?: string | null;
      submissionReference?: string | null;
      submittedAt?: string | null;
      followUpInstructions?: string | null;
    };
  } catch {
    return {};
  }
}

function formatEventLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function JobDetailPage({
  params,
  searchParams,
}: JobDetailPageProps) {
  await ensureDefaultRecords();
  const { id } = await params;
  const parsedId = Number(id);
  const status = searchParams ? await searchParams : undefined;
  const [detail, budget, usage] = await Promise.all([
    Number.isFinite(parsedId) ? getJobDetail(parsedId) : Promise.resolve(null),
    getAiBudgetSettings(),
    getAiUsageSummary(),
  ]);
  const mutationStatus = getHostedPreviewMutationStatus();

  if (!detail) {
    notFound();
  }

  const reasonsFor = parseReasonList(detail.score?.reasonsForJson);
  const reasonsAgainst = parseReasonList(detail.score?.reasonsAgainstJson);
  const tier1Estimate = estimateTier1Cost(detail.snapshot?.rawText ?? "", 700);
  const projectedSpend = usage.spent + tier1Estimate.estimatedCost;
  const readiness = detail.applicationReadiness;

  return (
    <PageFrame
      eyebrow="Job Detail"
      title={detail.job.title}
      description="This page now shows the latest score, the analysis history behind it, the posting snapshot, and the workflow actions that move a job from review into application tracking."
      metrics={[
        {
          label: "Latest Tier",
          value: formatTier(detail.score?.tier),
          hint: "Deep analysis remains approval-gated.",
        },
        {
          label: "Recommendation",
          value: formatRecommendation(detail.score?.recommendation),
          hint: "Current next-best action from the scoring layer.",
        },
        {
          label: "Score",
          value: detail.score?.overallScore?.toFixed(0) ?? "n/a",
          hint: `Analysis runs stored: ${detail.scores.length}.`,
        },
        {
          label: "Postings Seen",
          value: String(detail.alternatePostings.length),
          hint: "Preferred source plus any duplicate cross-postings we have seen for this role.",
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

      {mutationStatus.readOnlyHostedPreview ? (
        <ReadOnlyNotice message={mutationStatus.message} />
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
              {detail.job.sourceUrl ? (
                <a
                  className="text-[var(--accent)] underline"
                  href={detail.job.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open source posting
                </a>
              ) : (
                "Not saved yet"
              )}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
              <div className="text-sm font-medium text-[var(--foreground)]">
                Alternate postings
              </div>
              <div className="mt-2 space-y-3">
                {detail.alternatePostings.map((posting) => (
                  <div
                    key={posting.id}
                    className="rounded-xl border border-[var(--border)] bg-white/80 p-3"
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-medium text-[var(--foreground)]">
                          {formatSourceLabel(posting.source)}
                          {posting.isCanonical ? " | preferred source" : ""}
                          {posting.isCurrent && !posting.isCanonical ? " | this record" : ""}
                        </div>
                        <div className="mt-1 leading-6">
                          Seen {new Date(posting.discoveredAt).toLocaleString()}
                        </div>
                        {posting.sourceUrl ? (
                          <a
                            className="mt-2 inline-block text-[var(--accent)] underline"
                            href={posting.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open posting
                          </a>
                        ) : (
                          <div className="mt-2">No posting URL stored for this source.</div>
                        )}
                      </div>
                      <div className="text-sm text-[var(--muted)] lg:text-right">
                        <div>Stage: {posting.currentStage}</div>
                        <div className="mt-1">
                          Score: {posting.score?.overallScore?.toFixed(0) ?? "n/a"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                  disabled={!mutationStatus.writesAllowed}
                  className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
                disabled={!mutationStatus.writesAllowed}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                disabled={!mutationStatus.writesAllowed}
                className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
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

      <InfoCard
        title="Analysis History"
        body="Every scoring pass is retained so you can see whether this job still only has a fast Tier 0 read or has already been through a richer Tier 1 evaluation."
      >
        <div className="space-y-4">
          {detail.scores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
              No analysis runs have been stored for this job yet.
            </div>
          ) : (
            detail.scores.map((score) => {
              const historicalReasonsFor = parseReasonList(score.reasonsForJson);
              const historicalReasonsAgainst = parseReasonList(score.reasonsAgainstJson);

              return (
                <div
                  key={score.id}
                  className="rounded-2xl border border-[var(--border)] bg-white/70 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                          {formatTier(score.tier)}
                        </div>
                        <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground)]">
                          {formatRecommendation(score.recommendation)}
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-[var(--muted)]">
                        {score.summary ?? "No summary saved for this analysis run."}
                      </div>
                    </div>
                    <div className="text-sm text-[var(--muted)] lg:text-right">
                      <div className="text-xl font-semibold text-[var(--foreground)]">
                        {score.overallScore?.toFixed(0) ?? "n/a"}
                      </div>
                      <div className="mt-1">
                        {new Date(score.analyzedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <span>Resume lane: {score.recommendedResumeType ?? "not set"}</span>
                    <span>
                      Deep review: {score.deepReviewRecommended ? "recommended" : "not recommended"}
                    </span>
                  </div>

                  {score.deepReviewReason ? (
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-white/75 p-3 text-sm text-[var(--muted)]">
                      <span className="font-medium text-[var(--foreground)]">Deep review note:</span>{" "}
                      {score.deepReviewReason}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="text-sm font-medium text-[var(--foreground)]">Positive signals</div>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-[var(--muted)]">
                        {historicalReasonsFor.length === 0 ? (
                          <li>No positive signals were stored for this run.</li>
                        ) : (
                          historicalReasonsFor.map((reason) => <li key={reason}>{reason}</li>)
                        )}
                      </ul>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[var(--foreground)]">Risks and gaps</div>
                      <ul className="mt-2 space-y-2 text-sm leading-6 text-[var(--muted)]">
                        {historicalReasonsAgainst.length === 0 ? (
                          <li>No caution flags were stored for this run.</li>
                        ) : (
                          historicalReasonsAgainst.map((reason) => <li key={reason}>{reason}</li>)
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </InfoCard>

      <InfoCard
        title="Draft Packet"
        body="This is the shortlist-to-application handoff: the latest resume strategy and cover letter, whether the application record is linked to them, and what still blocks a clean ready-to-apply state."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            {
              title: "Resume strategy",
              latest: detail.draftPacket.latestResumeStrategy,
              approved: detail.draftPacket.approvedResumeStrategy,
              preferred: detail.draftPacket.preferredResumeStrategy,
              linked: detail.draftPacket.linkedResumeStrategy,
            },
            {
              title: "Cover letter",
              latest: detail.draftPacket.latestCoverLetter,
              approved: detail.draftPacket.approvedCoverLetter,
              preferred: detail.draftPacket.preferredCoverLetter,
              linked: detail.draftPacket.linkedCoverLetter,
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-[var(--foreground)]">{item.title}</div>
                <div className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                  {item.latest ? "available" : "missing"}
                </div>
              </div>
              {item.latest ? (
                <div className="mt-3 space-y-2 text-[var(--muted)]">
                  <div>
                    Latest draft: {formatDocumentType(item.latest.documentType)} v{item.latest.version}
                  </div>
                  <div>
                    Approved for submission:{" "}
                    {item.approved ? `v${item.approved.version}` : "none yet"}
                  </div>
                  <div>
                    Preferred packet version:{" "}
                    {item.preferred ? `v${item.preferred.version}` : "none yet"}
                  </div>
                  <div className="break-all">{item.latest.filePath}</div>
                  <div>
                    Linked to application:{" "}
                    {item.linked?.id === item.latest.id
                      ? "yes"
                      : item.linked
                        ? `no, linked to v${item.linked.version}`
                        : "not yet"}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-[var(--muted)]">
                  No draft has been generated for this document type yet.
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm text-[var(--muted)]">
          <div className="font-medium text-[var(--foreground)]">Readiness check</div>
          <div className="mt-2">
            {detail.draftPacket.hasCompleteDraftPacket
              ? "A complete draft packet exists for this job."
              : `Still missing: ${detail.draftPacket.missingDocuments.join(", ")}.`}
          </div>
          {detail.application ? (
            <div className="mt-2">
              {detail.draftPacket.needsResumeRefresh || detail.draftPacket.needsCoverLetterRefresh
                ? "The application record is not linked to the latest draft packet yet. Refresh it to sync the newest drafts."
                : "The application record is aligned with the latest draft packet."}
            </div>
          ) : (
            <div className="mt-2">
              No application record exists yet. Create one after you are happy with the draft packet.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
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
              disabled={!mutationStatus.writesAllowed}
              className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {detail.application ? "Refresh application links" : "Create application record"}
            </button>
          </form>
        </div>
      </InfoCard>

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
              disabled={!mutationStatus.writesAllowed}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
              disabled={!mutationStatus.writesAllowed}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                      disabled={!mutationStatus.writesAllowed}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
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

      {detail.application ? (
        <InfoCard
          title="Submission Timeline"
          body="Use this structured event log for confirmations, recruiter replies, interview requests, rejections, and follow-up actions. Later, this is the surface we can feed from an email inbox integration."
        >
          <form action={logApplicationEventAction} className="grid gap-4 xl:grid-cols-2">
            <input type="hidden" name="applicationId" value={detail.application.id} />
            <input type="hidden" name="jobId" value={detail.job.id} />
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Event type
              <select
                name="eventType"
                defaultValue="confirmation_received"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              >
                <option value="confirmation_received">Confirmation received</option>
                <option value="employer_reply_received">Employer reply received</option>
                <option value="follow_up_sent">Follow-up sent</option>
                <option value="interview_requested">Interview requested</option>
                <option value="rejection_received">Rejection received</option>
                <option value="custom_note">Custom note</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Occurred at
              <input
                name="occurredAt"
                type="datetime-local"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)] xl:col-span-2">
              Summary
              <input
                name="summary"
                type="text"
                placeholder="Confirmation email received from hiring team"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)] xl:col-span-2">
              Details
              <textarea
                name="details"
                rows={3}
                placeholder="Paste the important details, next steps, or contact information."
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Reminder title
              <input
                name="reminderTitle"
                type="text"
                placeholder="Follow up on application"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Reminder due
              <input
                name="reminderDueAt"
                type="datetime-local"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <div className="xl:col-span-2">
              <button
                type="submit"
                disabled={!mutationStatus.writesAllowed}
                className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Log application event
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3">
            {detail.applicationHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No submission events logged yet.
              </div>
            ) : (
              detail.applicationHistory.map((event) => {
                const payload = parseEventPayload(event.payloadJson);
                const occurredAt = payload.occurredAt ?? payload.submittedAt ?? event.createdAt;

                return (
                  <div
                    key={event.id}
                    className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="font-medium text-[var(--foreground)]">
                          {payload.summary ?? formatEventLabel(event.eventType)}
                        </div>
                        <div className="mt-1 text-[var(--muted)]">
                          {new Date(occurredAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                        {formatEventLabel(event.eventType)}
                      </div>
                    </div>
                    {payload.details ? (
                      <div className="mt-3 whitespace-pre-wrap text-[var(--muted)]">
                        {payload.details}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      {payload.submissionUrl ? <span>Submission URL saved</span> : null}
                      {payload.submissionReference ? <span>Reference captured</span> : null}
                      {payload.reminderDueAt ? (
                        <span>Reminder due {new Date(payload.reminderDueAt).toLocaleString()}</span>
                      ) : null}
                      {payload.followUpInstructions ? <span>Follow-up instructions captured</span> : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </InfoCard>
      ) : null}

      {detail.application ? (
        <InfoCard
          title="Submission Workflow"
          body="This section now includes the final ready-to-submit gate, so a record only becomes Ready when the packet, submission target, and any required follow-up instructions are all in place."
        >
          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm text-[var(--muted)]">
            {detail.draftPacket.hasCompleteDraftPacket
              ? detail.draftPacket.needsResumeRefresh || detail.draftPacket.needsCoverLetterRefresh
                ? "A complete packet exists, but this application is not linked to the latest drafts yet."
                : "A complete draft packet is linked to this application."
              : `This application is still missing: ${detail.draftPacket.missingDocuments.join(", ")}.`}
          </div>
          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-sm text-[var(--muted)]">
            <div className="font-medium text-[var(--foreground)]">Ready-to-submit checklist</div>
            <div className="mt-3 space-y-2">
              {readiness.readyItems.map((item) => (
                <div key={item.key}>
                  {item.complete ? "Complete" : "Missing"} | {item.label}
                </div>
              ))}
            </div>
            <div className="mt-3">
              {readiness.readyToSubmit
                ? "This application passes the final submission gate."
                : `Still blocking Ready: ${readiness.missingReadyItems.join(", ")}.`}
            </div>
            {detail.application.status !== "new" && detail.application.status !== "ready" ? (
              <div className="mt-3">
                {readiness.submissionRecordComplete
                  ? "Submission record is complete."
                  : `Submission record still needs: ${readiness.missingSubmissionItems.join(", ")}.`}
              </div>
            ) : null}
          </div>
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
                <option value="new">Drafting</option>
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
              Follow-up required
              <input
                name="followUpRequired"
                type="checkbox"
                defaultChecked={detail.application.followUpRequired}
                className="mt-3 h-4 w-4"
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
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Next follow-up due
              <input
                name="nextFollowUpAt"
                type="datetime-local"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--foreground)] xl:col-span-2">
              Follow-up instructions
              <textarea
                name="followUpInstructions"
                rows={3}
                defaultValue={detail.application.followUpInstructions ?? ""}
                placeholder="Optional unless follow-up is required for this application."
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
                disabled={!mutationStatus.writesAllowed}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
