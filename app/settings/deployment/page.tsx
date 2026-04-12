import { InfoCard } from "@/components/ui/info-card";
import { PageFrame } from "@/components/ui/page-frame";
import { ensureDefaultRecords } from "@/lib/bootstrap/ensure-defaults";
import { getDeploymentReadinessReport } from "@/lib/runtime/deployment-readiness";

function statusLabel(level: "ready" | "attention" | "blocked" | "info") {
  if (level === "ready") {
    return "Ready";
  }

  if (level === "attention") {
    return "Needs Attention";
  }

  if (level === "blocked") {
    return "Blocked";
  }

  return "Info";
}

function statusClasses(level: "ready" | "attention" | "blocked" | "info") {
  if (level === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (level === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }

  if (level === "blocked") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  return "border-[var(--border)] bg-white/70 text-[var(--muted)]";
}

export default async function DeploymentSettingsPage() {
  await ensureDefaultRecords();
  const report = getDeploymentReadinessReport();

  return (
    <PageFrame
      eyebrow="Deployment"
      title="Make the hosted rollout explicit before we flip it on."
      description="This page turns deployment prep into a checklist: runtime expectations, hosted database target, Gmail prerequisites, and the exact next steps needed before a Vercel test is honest."
      metrics={[
        {
          label: "Runtime",
          value: report.runtime.runtimeLabel,
          hint: report.runtime.browserAutomationMessage,
        },
        {
          label: "Ready Checks",
          value: String(report.summary.readyCount),
          hint: "Checklist items already in a good state.",
        },
        {
          label: "Blocked Checks",
          value: String(report.summary.blockedCount),
          hint: "Items still preventing a clean hosted rollout.",
        },
        {
          label: "Storage Mode",
          value: report.runtime.database.label,
          hint: report.runtime.database.message,
        },
      ]}
    >
      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <InfoCard
          title="Readiness checklist"
          body="This is the honest answer to whether the current build can be tested on Vercel without hidden local assumptions."
        >
          <div className="space-y-3">
            {report.items.map((item) => (
              <div
                key={item.key}
                className={`rounded-2xl border p-4 text-sm ${statusClasses(item.level)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-medium">{item.label}</div>
                  <div className="rounded-full border border-current/15 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]">
                    {statusLabel(item.level)}
                  </div>
                </div>
                <div className="mt-2 leading-6">{item.message}</div>
              </div>
            ))}
          </div>
        </InfoCard>

        <InfoCard
          title="Next commands"
          body="Once the hosted database target exists, these are the commands and checkpoints that move local state into the hosted stack."
        >
          <div className="space-y-4 text-sm text-[var(--muted)]">
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
              <div className="font-medium text-[var(--foreground)]">Hosted migration</div>
              <div className="mt-2 font-mono text-xs">npm run db:migrate:hosted</div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
              <div className="font-medium text-[var(--foreground)]">Hosted data sync</div>
              <div className="mt-2 font-mono text-xs">npm run db:push:hosted</div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
              <div className="font-medium text-[var(--foreground)]">Checklist</div>
              <div className="mt-2 space-y-2">
                {report.nextSteps.map((step) => (
                  <div key={step}>{step}</div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
              <div className="font-medium text-[var(--foreground)]">
                Runtime cutover inventory
              </div>
              <div className="mt-2 font-mono text-xs">npm run deployment:inventory</div>
              <div className="mt-2 leading-6">
                Use this to measure how many app and lib files still depend on the synchronous
                SQLite call shape before the hosted runtime switch.
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-4">
              <div className="font-medium text-[var(--foreground)]">Verification endpoint</div>
              <div className="mt-2 leading-6">
                Hosted previews can report their safe readiness posture at
                <span className="ml-1 font-mono text-xs text-[var(--foreground)]">
                  /api/deployment/status
                </span>
                .
              </div>
            </div>
          </div>
        </InfoCard>
      </div>
    </PageFrame>
  );
}
