import Link from "next/link";

import {
  captureInboxMessageAction,
  disconnectGmailInboxAction,
  linkInboxMessageToApplicationAction,
  markInboxMessageReviewedAction,
  syncGmailInboxAction,
  updateInboxConnectionAction,
} from "@/app/settings/inbox/actions";
import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getGmailSetupStatus } from "@/lib/inbox/gmail";
import {
  getInboxConnection,
  getInboxSummary,
  listInboxLinkOptions,
} from "@/lib/inbox/queries";
import {
  getHostedDatabaseTargetStatus,
  getHostedPreviewMutationStatus,
  getRuntimeEnvironmentSummary,
} from "@/lib/runtime/deployment";

type InboxSettingsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

export default async function InboxSettingsPage({
  searchParams,
}: InboxSettingsPageProps) {
  await ensureDefaultRecords();
  const params = searchParams ? await searchParams : undefined;
  const gmailSetup = getGmailSetupStatus();
  const runtime = getRuntimeEnvironmentSummary();
  const hostedTarget = getHostedDatabaseTargetStatus();
  const mutationStatus = getHostedPreviewMutationStatus();
  const [connection, summary, linkOptions] = await Promise.all([
    getInboxConnection(),
    getInboxSummary(),
    listInboxLinkOptions(),
  ]);
  const isGmailProvider = connection?.provider === "gmail";
  const isGmailConnected =
    isGmailProvider && connection?.connectionStatus === "connected";

  return (
    <PageFrame
      eyebrow="Inbox Layer"
      title="Capture employer replies without losing the thread."
      description="The inbox layer now supports a Gmail-first connection flow, recent-message sync, manual linking for low-confidence matches, and explicit review state so inbound replies do not disappear into the background."
      metrics={[
        {
          label: "Captured Messages",
          value: String(summary.total),
          hint: "Inbox messages stored locally so far.",
        },
        {
          label: "Matched Replies",
          value: String(summary.matched),
          hint: "Messages that were attached to a known application record.",
        },
        {
          label: "New Replies",
          value: String(summary.unreviewedActionable),
          hint: "Matched inbox activity that still needs your attention.",
        },
        {
          label: "Connection",
          value: connection?.isEnabled ? "Enabled" : "Disabled",
          hint:
            connection?.provider === "gmail" && connection?.providerAccountEmail
              ? `${connection.connectionStatus} as ${connection.providerAccountEmail}`
              : connection?.connectionStatus ?? "not_connected",
        },
        {
          label: "Runtime",
          value: runtime.runtimeLabel,
          hint: gmailSetup.storageMessage,
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

      {mutationStatus.readOnlyHostedPreview ? (
        <ReadOnlyNotice message={mutationStatus.message} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.5fr]">
        <InfoCard
          title="Inbox connection policy"
          body="This layer stays workflow-first. Desktop use can keep Gmail state in local SQLite, while durable hosted deployments can store inbox state in LibSQL/Turso. Ephemeral previews remain read-only."
        >
          <form action={updateInboxConnectionAction}>
            <fieldset
              disabled={!mutationStatus.writesAllowed}
              className={`space-y-4 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
            >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Provider
                <select
                  name="provider"
                  defaultValue={connection?.provider ?? "manual"}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                >
                  <option value="manual">Manual capture</option>
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook later</option>
                  <option value="imap">IMAP later</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Connection status
                <select
                  name="connectionStatus"
                  defaultValue={connection?.connectionStatus ?? "not_connected"}
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                >
                  <option value="not_connected">Not connected</option>
                  <option value="ready_for_auth">Ready for auth</option>
                  <option value="connected">Connected</option>
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium text-[var(--foreground)]">
              Monitored inbox address
              <input
                name="monitoredAddress"
                type="email"
                defaultValue={connection?.monitoredAddress ?? ""}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>

            <label className="block text-sm font-medium text-[var(--foreground)]">
              Forwarding or webhook target
              <input
                name="forwardingAddress"
                type="text"
                defaultValue={connection?.forwardingAddress ?? ""}
                placeholder="job-search-inbox@local-only.invalid"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>

            <label className="block text-sm font-medium text-[var(--foreground)]">
              Gmail sync query
              <input
                name="syncQuery"
                type="text"
                defaultValue={connection?.syncQuery ?? gmailSetup.defaultSyncQuery}
                placeholder="newer_than:30d"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
                <div className="font-medium">Enable layer</div>
                <input
                  name="isEnabled"
                  type="checkbox"
                  defaultChecked={connection?.isEnabled ?? false}
                  className="mt-3 h-4 w-4"
                />
              </label>
              <label className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
                <div className="font-medium">Auto reminders</div>
                <input
                  name="autoCreateReminders"
                  type="checkbox"
                  defaultChecked={connection?.autoCreateReminders ?? true}
                  className="mt-3 h-4 w-4"
                />
              </label>
              <label className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
                <div className="font-medium">Reply notifications</div>
                <input
                  name="notifyOnEmployerReplies"
                  type="checkbox"
                  defaultChecked={connection?.notifyOnEmployerReplies ?? true}
                  className="mt-3 h-4 w-4"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-[var(--foreground)]">
              Notes
              <textarea
                name="notes"
                rows={3}
                defaultValue={connection?.notes ?? ""}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save inbox settings
            </button>
            </fieldset>
          </form>
        </InfoCard>

        <InfoCard
          title="Gmail live sync"
          body="Use this panel to connect a Gmail inbox, run a fresh pull of recent messages, and see whether the current runtime is actually ready for Google OAuth and durable token storage."
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-white/70 p-4 text-sm">
              <div className="font-medium text-[var(--foreground)]">Environment readiness</div>
              <div className="mt-2 text-[var(--muted)]">
                {gmailSetup.configured
                  ? "Google OAuth environment variables are configured."
                  : `Missing ${gmailSetup.missingVars.join(", ")}.`}
              </div>
              <div className="mt-2 text-[var(--muted)]">{gmailSetup.appBaseUrlMessage}</div>
              <div className="mt-2 text-[var(--muted)]">{gmailSetup.storageMessage}</div>
              <div className="mt-2 text-[var(--muted)]">{hostedTarget.message}</div>
              <div className="mt-2 text-xs text-[var(--muted)]">
                Callback URL: {gmailSetup.callbackUrl}
              </div>
              {connection?.lastSyncError ? (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  Last Gmail error: {connection.lastSyncError}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-white/70 p-4 text-sm">
              <div className="font-medium text-[var(--foreground)]">Connection state</div>
              <div className="mt-2 text-[var(--muted)]">
                Provider: {connection?.provider ?? "manual"} | Status:{" "}
                {connection?.connectionStatus ?? "not_connected"}
              </div>
              <div className="mt-2 text-[var(--muted)]">
                Account: {connection?.providerAccountEmail ?? "not connected yet"}
              </div>
              <div className="mt-2 text-[var(--muted)]">
                Last sync:{" "}
                {connection?.lastSyncCompletedAt
                  ? new Date(connection.lastSyncCompletedAt).toLocaleString()
                  : "none yet"}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {gmailSetup.configured ? (
                  <a
                    href={gmailSetup.readyForLiveSync ? "/api/inbox/gmail/start" : undefined}
                    aria-disabled={!gmailSetup.readyForLiveSync || !mutationStatus.writesAllowed}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  >
                    {isGmailConnected ? "Reconnect Gmail" : "Connect Gmail"}
                  </a>
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]">
                    Add the Google OAuth env vars before connecting Gmail.
                  </div>
                )}

                <form action={syncGmailInboxAction}>
                  <button
                    type="submit"
                    disabled={
                      !isGmailConnected ||
                      !gmailSetup.readyForLiveSync ||
                      !mutationStatus.writesAllowed
                    }
                    className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sync Gmail now
                  </button>
                </form>

                <form action={disconnectGmailInboxAction}>
                  <button
                    type="submit"
                    disabled={!isGmailProvider || !mutationStatus.writesAllowed}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Disconnect Gmail
                  </button>
                </form>
              </div>
            </div>
          </div>
        </InfoCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.95fr]">
        <InfoCard
          title="Inbox attention queue"
          body="New matched replies stay here until you explicitly review them. This is the safest handoff from Gmail sync into the rest of the workflow."
        >
          <div className="space-y-3">
            {summary.attentionQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No new matched inbox replies are waiting right now.
              </div>
            ) : (
              summary.attentionQueue.map(({ message, job, company }) => (
                <div
                  key={message.id}
                  className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-medium text-[var(--foreground)]">{message.subject}</div>
                      <div className="mt-1 text-[var(--muted)]">
                        {message.senderEmail} | {new Date(message.receivedAt).toLocaleString()}
                      </div>
                      <div className="mt-2 text-[var(--muted)]">
                        {company?.name ?? "Matched company pending parse"} |{" "}
                        {job ? (
                          <Link href={`/jobs/${job.id}`} className="underline">
                            {job.title}
                          </Link>
                        ) : (
                          "Matched job pending parse"
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 lg:min-w-[11rem]">
                      <div className="rounded-full border border-[var(--border)] px-3 py-1 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                        {message.messageType.replaceAll("_", " ")}
                      </div>
                      <form action={markInboxMessageReviewedAction}>
                        <input type="hidden" name="inboxMessageId" value={message.id} />
                        <button
                          type="submit"
                          disabled={!mutationStatus.writesAllowed}
                          className="w-full rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Mark reviewed
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </InfoCard>

        <InfoCard
          title="Inbox mix"
          body="This gives you a fast sense of what kind of inbound mail the app is seeing as it syncs Gmail."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Confirmations
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {summary.typeCounts.confirmation}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Employer Replies
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {summary.typeCounts.employerReply}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Interviews
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {summary.typeCounts.interview}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Rejections
              </div>
              <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {summary.typeCounts.rejection}
              </div>
            </div>
          </div>
        </InfoCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
        <InfoCard
          title="Manual intake"
          body="Manual capture still matters. It is the fallback when Gmail is not connected yet, and it is also how you can test the matching and timeline flow safely."
        >
          <form action={captureInboxMessageAction}>
            <fieldset
              disabled={!mutationStatus.writesAllowed}
              className={`space-y-4 ${!mutationStatus.writesAllowed ? "opacity-60" : ""}`}
            >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="senderName"
                type="text"
                placeholder="Recruiter name"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
              <input
                name="senderEmail"
                type="email"
                required
                placeholder="talent@company.com"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
              />
            </div>
            <input
              name="subject"
              type="text"
              required
              placeholder="Application received for Operations Manager"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <input
              name="receivedAt"
              type="datetime-local"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <textarea
              name="snippet"
              rows={2}
              placeholder="Short preview or excerpt"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <textarea
              name="bodyText"
              rows={6}
              placeholder="Paste the body of the employer message here"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Capture inbox message
            </button>
            </fieldset>
          </form>
        </InfoCard>

        <InfoCard
          title="Unmatched inbox messages"
          body="These are the messages the app stored but could not confidently attach to an application yet. You can now link them manually without leaving the inbox workspace."
        >
          <div className="space-y-3">
            {summary.recentUnmatched.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
                No unmatched inbox messages right now.
              </div>
            ) : (
              summary.recentUnmatched.map(({ message }) => (
                <div
                  key={message.id}
                  className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
                >
                  <div className="font-medium text-[var(--foreground)]">{message.subject}</div>
                  <div className="mt-1 text-[var(--muted)]">
                    {message.senderEmail} | {new Date(message.receivedAt).toLocaleString()}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {message.messageType.replaceAll("_", " ")}
                  </div>
                  <form
                    action={linkInboxMessageToApplicationAction}
                    className="mt-3 flex flex-col gap-3"
                  >
                    <input type="hidden" name="inboxMessageId" value={message.id} />
                    <select
                      name="applicationId"
                      defaultValue=""
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                    >
                      <option value="" disabled>
                        Link to application...
                      </option>
                      {linkOptions.map((option) => (
                        <option key={option.applicationId} value={option.applicationId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={!mutationStatus.writesAllowed}
                        className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Link message
                      </button>
                      <button
                        formAction={markInboxMessageReviewedAction}
                        type="submit"
                        disabled={!mutationStatus.writesAllowed}
                        className="rounded-xl border border-[var(--border)] px-4 py-2 font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </form>
                </div>
              ))
            )}
          </div>
        </InfoCard>
      </div>

      <InfoCard
        title="Recent inbox activity"
        body="Matched replies should already appear in the job-level submission timeline. This log is the inbox-side audit trail, including Gmail-synced messages."
      >
        <div className="space-y-3">
          {summary.recentReplies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--muted)]">
              No matched employer replies yet.
            </div>
          ) : (
            summary.recentReplies.map(({ message, job, company }) => (
              <div
                key={message.id}
                className="rounded-xl border border-[var(--border)] bg-white/70 p-3 text-sm"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{message.subject}</div>
                    <div className="mt-1 text-[var(--muted)]">
                      {message.senderEmail} | {new Date(message.receivedAt).toLocaleString()}
                    </div>
                    <div className="mt-2 text-[var(--muted)]">
                      {company?.name ?? "Matched company pending parse"} |{" "}
                      {job ? (
                        <Link href={`/jobs/${job.id}`} className="underline">
                          {job.title}
                        </Link>
                      ) : (
                        "Open matched job"
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
                      {message.matchedStatus}
                    </div>
                    <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                      {message.messageType.replaceAll("_", " ")}
                    </div>
                    {message.reviewedAt ? (
                      <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
                        Reviewed
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </InfoCard>
    </PageFrame>
  );
}
