import {
  enableBrowserSearchBundleAction,
  updatePlatformConnectionAction,
  verifyPlatformConnectionAction,
} from "@/app/connections/actions";
import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ReadOnlyNotice } from "@/components/ui/read-only-notice";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { listPlatformConnections } from "@/lib/connections/queries";
import { inspectBrowserAutomation, supportedBrowserTypes } from "@/lib/playwright/profile";
import {
  getHostedDatabaseTargetStatus,
  getHostedPreviewMutationStatus,
  getRuntimeEnvironmentSummary,
} from "@/lib/runtime/deployment";

type ConnectionsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
  }>;
};

const browserBackedPlatforms = ["google_jobs", "linkedin", "indeed", "upwork", "fiverr"];

export default async function ConnectionsPage({
  searchParams,
}: ConnectionsPageProps) {
  await ensureDefaultRecords();
  const connections = await listPlatformConnections();
  const runtime = getRuntimeEnvironmentSummary();
  const hostedTarget = getHostedDatabaseTargetStatus();
  const mutationStatus = getHostedPreviewMutationStatus();
  const inspections = connections.map((connection) => ({
    connection,
    inspection: inspectBrowserAutomation({
      isEnabled: connection.isEnabled,
      browserType: connection.browserType,
      browserProfileName: connection.browserProfileName,
    }),
    verificationInspection: inspectBrowserAutomation({
      isEnabled: true,
      browserType: connection.browserType,
      browserProfileName: connection.browserProfileName,
      bypassEnabledCheck: true,
    }),
  }));
  const params = searchParams ? await searchParams : undefined;

  return (
    <PageFrame
      eyebrow="Platform Connections"
      title="Keep session-based automation under your control."
      description="This area manages the dedicated browser profile, per-platform access state, and easy disconnect controls for services like LinkedIn, Google Jobs, and Upwork."
      metrics={[
        {
          label: "Enabled Platforms",
          value: String(inspections.filter(({ connection }) => connection.isEnabled).length),
          hint: "Platforms currently allowed for connection-aware workflows.",
        },
        {
          label: "Browser-Ready",
          value: String(
            inspections.filter(({ inspection }) => inspection.status === "ready").length,
          ),
          hint: "Platforms whose current connection settings are usable on this machine.",
        },
        {
          label: "Runtime",
          value: runtime.runtimeLabel,
          hint: runtime.browserAutomationMessage,
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

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <InfoCard
          title="Connection policy"
          body="The app will rely on your local browser session where needed, but each platform must remain easy to disable or disconnect independently."
        >
          <div className="space-y-4">
            {inspections.map(({ connection, inspection }) => (
              <form
                key={connection.id}
                action={updatePlatformConnectionAction}
                className="rounded-2xl border border-[var(--border)] bg-white/70 p-4"
              >
                <fieldset
                  disabled={!mutationStatus.writesAllowed}
                  className={!mutationStatus.writesAllowed ? "opacity-60" : ""}
                >
                <input type="hidden" name="platform" value={connection.platform} />
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-lg font-semibold">{connection.platform}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      Current readiness: {inspection.status}
                      {connection.lastVerifiedAt
                        ? ` | last verified ${new Date(connection.lastVerifiedAt).toLocaleString()}`
                        : ""}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{inspection.message}</div>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      name="isEnabled"
                      defaultChecked={connection.isEnabled}
                    />
                    Enabled
                  </label>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    Browser type
                    <select
                      name="browserType"
                      defaultValue={connection.browserType ?? ""}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                    >
                      <option value="">None</option>
                      {supportedBrowserTypes.map((browserType) => (
                        <option key={browserType} value={browserType}>
                          {browserType}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    Browser profile name
                    <input
                      name="browserProfileName"
                      type="text"
                      defaultValue={connection.browserProfileName ?? ""}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    Connection mode
                    <select
                      name="connectionMode"
                      defaultValue={connection.connectionMode ?? "launch"}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                    >
                      <option value="launch">Launch profile directly</option>
                      <option value="attach">Attach to running browser</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    Debug port
                    <input
                      name="debugPort"
                      type="number"
                      inputMode="numeric"
                      defaultValue={connection.debugPort ?? 9222}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[var(--foreground)] xl:col-span-2">
                    Notes
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={connection.notes ?? ""}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
                  <div>Connection mode: {connection.connectionMode ?? "launch"}</div>
                  {connection.debugPort ? <div>Debug port: {connection.debugPort}</div> : null}
                  {inspection.browserType ? (
                    <div>
                      Browser data folder:{" "}
                      {inspection.resolvedRootPath ?? "Not detected yet"}
                    </div>
                  ) : null}
                  {inspection.resolvedProfilePath ? (
                    <div>Resolved profile path: {inspection.resolvedProfilePath}</div>
                  ) : null}
                  {inspection.detectedProfiles.length > 0 ? (
                    <div>
                      Detected profiles:{" "}
                      {inspection.detectedProfiles
                        .map((profile) => `${profile.name} (${profile.directory})`)
                        .join(", ")}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4">
                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save connection settings
                  </button>
                </div>
                </fieldset>
              </form>
            ))}
          </div>
        </InfoCard>

        <InfoCard
          title="Deployment posture"
          body={
            runtime.isHosted
              ? "Browser-backed sources stay intentionally disabled on hosted runtimes. Vercel previews can still boot against ephemeral SQLite storage, but that mode is for UI testing only until hosted persistence is wired into the live runtime."
              : "This machine can keep using the local Job Search OS browser profile for session-backed sources. Hosted deploys should still treat those collectors as local-only."
          }
        >
          <div className="space-y-3 text-sm text-[var(--muted)]">
            <div>
              Runtime: <span className="font-medium text-[var(--foreground)]">{runtime.runtimeLabel}</span>
            </div>
            <div>{runtime.browserAutomationMessage}</div>
            <div>{runtime.database.message}</div>
            <div>{hostedTarget.message}</div>
          </div>
        </InfoCard>

        <InfoCard
          title="Verify browser-backed sources"
          body="Verification checks whether the requested Chrome or Edge profile is detectable on this Windows machine. Attach mode is best when you want to keep the Job Search OS browser window open and reuse that live session."
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]/70 p-4">
              <div className="text-base font-semibold">Enable search bundle</div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                Turn on Google Jobs, LinkedIn, and Indeed together with the Job Search OS Chrome profile in attach mode so saved searches can start using the live browser-backed collectors immediately.
              </div>
              <form action={enableBrowserSearchBundleAction} className="mt-4">
                <button
                  type="submit"
                  disabled={!runtime.browserAutomationAvailable || !mutationStatus.writesAllowed}
                  className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Enable browser search bundle
                </button>
              </form>
              {!runtime.browserAutomationAvailable ? (
                <div className="mt-3 text-xs text-[var(--muted)]">
                  {runtime.browserAutomationMessage}
                </div>
              ) : null}
            </div>
            {inspections
              .filter(({ connection }) => browserBackedPlatforms.includes(connection.platform))
              .map(({ connection, verificationInspection }) => (
                <form
                  key={`verify-${connection.id}`}
                  action={verifyPlatformConnectionAction}
                  className="rounded-2xl border border-[var(--border)] bg-white/70 p-4"
                >
                  <input type="hidden" name="platform" value={connection.platform} />
                  <div className="text-base font-semibold">{connection.platform}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {verificationInspection.message}
                  </div>
                  <div className="mt-4">
                    <button
                      type="submit"
                      disabled={!runtime.browserAutomationAvailable || !mutationStatus.writesAllowed}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Verify browser profile
                    </button>
                  </div>
                </form>
              ))}
          </div>
        </InfoCard>
      </div>
    </PageFrame>
  );
}
